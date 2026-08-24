import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';

import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { removeEntity } from 'src/common/database/remove-entity';

/**
 * Categories form a tree inside one company. Every method takes the
 * `companyId` of the caller, read from their JWT, so a category can never be
 * read, moved or attached across company boundaries.
 */
@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto, companyId: string) {
    const parentId = createCategoryDto.parentId ?? null;

    if (parentId) {
      await this.findOne(parentId, companyId);
    }

    await this.assertNameIsFree(createCategoryDto.name, parentId, companyId);

    const category = this.categoryRepo.create({
      name: createCategoryDto.name,
      description: createCategoryDto.description,
      parentId,
      companyId,
    });

    return await this.categoryRepo.save(category);
  }

  async findAll(query: PaginationDto, companyId: string) {
    const { page, limit } = query;

    const [categories, total] = await this.categoryRepo.findAndCount({
      where: { companyId },
      relations: { parent: true },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data: categories,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, companyId: string) {
    const category = await this.categoryRepo.findOne({
      where: { id, companyId },
      relations: { parent: true },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
    companyId: string,
  ) {
    const category = await this.findOne(id, companyId);

    // `parentId` is only "being changed" when the client actually sent the
    // key — sending null means "make this a root category", which is
    // different from not sending it at all.
    const isMovingParent = 'parentId' in updateCategoryDto;
    const nextParentId = isMovingParent
      ? (updateCategoryDto.parentId ?? null)
      : category.parentId;

    if (isMovingParent && nextParentId !== category.parentId) {
      await this.assertParentIsValid(id, nextParentId, companyId);
    }

    const nextName = updateCategoryDto.name ?? category.name;

    if (nextName !== category.name || nextParentId !== category.parentId) {
      await this.assertNameIsFree(nextName, nextParentId, companyId, id);
    }

    category.name = nextName;
    category.parentId = nextParentId;

    if (updateCategoryDto.description !== undefined) {
      category.description = updateCategoryDto.description;
    }

    return await this.categoryRepo.save(category);
  }

  async remove(id: string, companyId: string) {
    const category = await this.findOne(id, companyId);

    const childCount = await this.categoryRepo.countBy({
      parentId: id,
      companyId,
    });

    if (childCount > 0) {
      throw new ConflictException(
        'Cannot delete a category that still has sub-categories',
      );
    }

    return await removeEntity(
      this.categoryRepo,
      category,
      'This category cannot be deleted: other records still reference it.',
    );
  }

  /**
   * A category cannot be its own parent, and cannot be moved under one of its
   * own descendants — either would create a loop that makes the tree
   * impossible to walk.
   */
  private async assertParentIsValid(
    id: string,
    parentId: string | null,
    companyId: string,
  ) {
    if (!parentId) {
      return;
    }

    if (parentId === id) {
      throw new BadRequestException('A category cannot be its own parent');
    }

    // Walk up from the wanted parent. If we meet the category being moved,
    // the parent is one of its descendants.
    let cursor = await this.findOne(parentId, companyId);

    while (cursor.parentId) {
      if (cursor.parentId === id) {
        throw new BadRequestException(
          'A category cannot be moved under one of its own sub-categories',
        );
      }

      cursor = await this.findOne(cursor.parentId, companyId);
    }
  }

  /**
   * Names are unique among siblings, inside one company.
   *
   * @param ignoreId Category being updated, so it does not clash with itself.
   */
  private async assertNameIsFree(
    name: string,
    parentId: string | null,
    companyId: string,
    ignoreId?: string,
  ) {
    const taken = await this.categoryRepo.existsBy({
      name,
      companyId,
      parentId: parentId ?? IsNull(),
      ...(ignoreId && { id: Not(ignoreId) }),
    });

    if (taken) {
      throw new ConflictException(
        'A category with this name already exists at this level',
      );
    }
  }
}
