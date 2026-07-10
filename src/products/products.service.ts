import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';
import { Repository } from 'typeorm';
import { ProductQueryDto } from './dto/product-query.dto';

@Injectable()
export class ProductsService {
  constructor(@InjectRepository(Product) private readonly productRepository: Repository<Product>) { }

  async create(createProductDto: CreateProductDto) {
    const existingProduct = await this.productRepository.findOne({
      where: [
        { name: createProductDto.name },
        { sku: createProductDto.sku },
      ],
    });

    if (existingProduct) {
      throw new ConflictException('Product already exists');
    }

    const product = this.productRepository.create(createProductDto);

    await this.productRepository.save(product);

    return product;
  }
  async findAll(query: ProductQueryDto) {
    const { page, limit } = query;

    const skip = (page - 1) * limit;

    const [products, total] =
      await this.productRepository.findAndCount({
        skip,
        take: limit,
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

  async findOne(id: string) {
    return await this.productRepository.findOneBy({ id });
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const product = await this.productRepository.findOneBy({ id });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (updateProductDto.sku || updateProductDto.name) {
      const conflict = await this.productRepository.findOne({
        where: [
          ...(updateProductDto.sku ? [{ sku: updateProductDto.sku }] : []),
          ...(updateProductDto.name ? [{ name: updateProductDto.name }] : []),
        ],
      });
      if (conflict && conflict.id !== id) {
        throw new ConflictException('Product with this name or SKU already exists');
      }
    }

    await this.productRepository.update(id, updateProductDto);

    return await this.productRepository.findOneBy({ id });
  }


  async remove(id: string) {
    const product = await this.productRepository.findOneBy({ id });

    if (!product) {
      throw new NotFoundException('Product not found');
    }
    await this.productRepository.delete(id);
    return product;
  }
}