import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';

import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';
import { ProductQueryDto } from './dto/product-query.dto';
import { Category } from 'src/categories/entities/category.entity';

/**
 * Every method takes the `companyId` of the caller, read from their JWT,
 * so a user can only ever see and touch the products of their own company.
 */
@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) { }

  async create(createProductDto: CreateProductDto, companyId: string) {
    await this.assertNoConflict(createProductDto, companyId);
    await this.assertCategoryBelongsToCompany(
      createProductDto.categoryId,
      companyId,
    );

    const product = this.productRepository.create({
      ...createProductDto,
      companyId,
    });

    return await this.productRepository.save(product);
  }

  async findAll(query: ProductQueryDto, companyId: string) {
    const { page, limit } = query;

    const [products, total] = await this.productRepository.findAndCount({
      where: { companyId },
      relations: { category: true },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data: products,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, companyId: string) {
    const product = await this.productRepository.findOne({
      where: { id, companyId },
      relations: { category: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  /**
   * Used by the purchasing flow to check a product may be ordered.
   * Same company scoping as `findOne`.
   */
  async findAvailableProduct(id: string, companyId: string) {
    return await this.findOne(id, companyId);
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    companyId: string,
  ) {
    const product = await this.findOne(id, companyId);

    await this.assertNoConflict(updateProductDto, companyId, id);

    if ('categoryId' in updateProductDto) {
      await this.assertCategoryBelongsToCompany(
        updateProductDto.categoryId,
        companyId,
      );
    }

    Object.assign(product, updateProductDto);

    return await this.productRepository.save(product);
  }

  async remove(id: string, companyId: string) {
    const product = await this.findOne(id, companyId);

    // TypeORM's remove() strips the primary key off the returned
    // entity, so the id is put back for the client.
    const removed = await this.productRepository.remove(product);

    return { ...removed, id };
  }

  /**
   * Name and SKU are unique per company, not globally — two companies keep
   * separate catalogues and may reuse the same SKU.
   *
   * @param ignoreId Product being updated, so it does not clash with itself.
   */
  private async assertNoConflict(
    dto: Partial<Pick<CreateProductDto, 'name' | 'sku'>>,
    companyId: string,
    ignoreId?: string,
  ) {
    const idFilter = ignoreId ? { id: Not(ignoreId) } : {};

    if (dto.sku) {
      const taken = await this.productRepository.existsBy({
        sku: dto.sku,
        companyId,
        ...idFilter,
      });

      if (taken) {
        throw new ConflictException('Product with this SKU already exists');
      }
    }

    if (dto.name) {
      const taken = await this.productRepository.existsBy({
        name: dto.name,
        companyId,
        ...idFilter,
      });

      if (taken) {
        throw new ConflictException('Product with this name already exists');
      }
    }
  }

  /**
   * Stops a product being filed under another company's category.
   */
  private async assertCategoryBelongsToCompany(
    categoryId: string | null | undefined,
    companyId: string,
  ) {
    if (!categoryId) {
      return;
    }

    const exists = await this.categoryRepository.existsBy({
      id: categoryId,
      companyId,
    });

    if (!exists) {
      throw new NotFoundException('Category not found');
    }
  }
}
