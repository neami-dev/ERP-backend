import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { Repository } from 'typeorm';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@Injectable()
export class CategoriesService {
  constructor(@InjectRepository(Category) private readonly categoryRepo: Repository<Category>) { }
  async create(createCategoryDto: CreateCategoryDto) {
    const existingcategory = await this.categoryRepo.existsBy(
      { name: createCategoryDto.name }
    );
    if (existingcategory) {
      throw new ConflictException('Category already exists');
    }

    let parent: Category | null = null;

    const parentId = createCategoryDto?.parentId

    if (parentId) {
      const categoryParent = await this.categoryRepo.findOneBy({ id: parentId });
      if (!categoryParent) {
        throw new NotFoundException('Parent category not found');

      }
      parent = categoryParent;
    }
    const category = this.categoryRepo.create({
      name: createCategoryDto.name,
      description: createCategoryDto.description,
      parent,
    });
    return this.categoryRepo.save(category);
  }


  async findAll(query: PaginationDto) {
    const { page, limit } = query;

    const skip = (page - 1) * limit;
    const [categories, total] = await this.categoryRepo.findAndCount({
      skip,
      take: limit,
      relations: {
        parent: true,
      },
    });

    return {
      data: categories,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async findOne(id: string) {
    const category = await this.categoryRepo.findOneBy({ id });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const category = await this.findOne(id);

    const parentId = updateCategoryDto?.parentId

    if (parentId) {
      const categoryParent = await this.categoryRepo.findOneBy({ id: parentId });
      if (!categoryParent) {
        throw new NotFoundException('Parent category not found');

      }
    }

    Object.assign(category, updateCategoryDto);
    return this.categoryRepo.save(category);
  }

  async remove(id: string) {
    const category = await this.findOne(id);
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return this.categoryRepo.remove(category);
  }
}
