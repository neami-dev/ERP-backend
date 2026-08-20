import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) { }

  @Post()
  @ApiOperation({ summary: 'Create a category for the current company' })
  create(
    @Body() createCategoryDto: CreateCategoryDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.categoriesService.create(createCategoryDto, companyId);
  }

  @Get()
  @ApiOperation({ summary: 'Get the categories of the current company' })
  findAll(
    @Query() query: PaginationDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.categoriesService.findAll(query, companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a category by ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.categoriesService.findOne(id, companyId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a category by ID' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.categoriesService.update(id, updateCategoryDto, companyId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a category by ID' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.categoriesService.remove(id, companyId);
  }
}
