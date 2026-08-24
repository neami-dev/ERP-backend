import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { RequirePermissions } from 'src/auth/decorators/require-permissions.decorator';
import { ApiPaginatedResponse } from 'src/common/dto/paginated.dto';
import { Permission } from 'src/common/permissions/permission';
import { Category } from './entities/category.entity';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @RequirePermissions(Permission.CATEGORIES_CREATE)
  @ApiOperation({ summary: 'Create a category for the current company' })
  @ApiCreatedResponse({ type: Category })
  create(
    @Body() createCategoryDto: CreateCategoryDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.categoriesService.create(createCategoryDto, companyId);
  }

  @Get()
  @RequirePermissions(Permission.CATEGORIES_READ)
  @ApiOperation({ summary: 'Get the categories of the current company' })
  @ApiPaginatedResponse(Category)
  findAll(
    @Query() query: PaginationDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.categoriesService.findAll(query, companyId);
  }

  @Get(':id')
  @RequirePermissions(Permission.CATEGORIES_READ)
  @ApiOperation({ summary: 'Get a category by ID' })
  @ApiOkResponse({ type: Category })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.categoriesService.findOne(id, companyId);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CATEGORIES_UPDATE)
  @ApiOperation({ summary: 'Update a category by ID' })
  @ApiOkResponse({ type: Category })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.categoriesService.update(id, updateCategoryDto, companyId);
  }

  @Delete(':id')
  @RequirePermissions(Permission.CATEGORIES_DELETE)
  @ApiOperation({ summary: 'Delete a category by ID' })
  @ApiOkResponse({ type: Category })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.categoriesService.remove(id, companyId);
  }
}
