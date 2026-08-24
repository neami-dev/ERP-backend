import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { RequirePermissions } from 'src/auth/decorators/require-permissions.decorator';
import { ApiPaginatedResponse } from 'src/common/dto/paginated.dto';
import { Permission } from 'src/common/permissions/permission';
import { Product } from './entities/product.entity';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @RequirePermissions(Permission.PRODUCTS_CREATE)
  @ApiOperation({ summary: 'Create a product for the current company' })
  @ApiCreatedResponse({ type: Product })
  create(
    @Body() createProductDto: CreateProductDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.productsService.create(createProductDto, companyId);
  }

  @Get()
  @RequirePermissions(Permission.PRODUCTS_READ)
  @ApiOperation({ summary: 'Get the products of the current company' })
  @ApiPaginatedResponse(Product)
  findAll(
    @Query() query: ProductQueryDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.productsService.findAll(query, companyId);
  }

  @Get(':id')
  @RequirePermissions(Permission.PRODUCTS_READ)
  @ApiOperation({ summary: 'Get a product by ID' })
  @ApiOkResponse({ type: Product })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.productsService.findOne(id, companyId);
  }

  @Patch(':id')
  @RequirePermissions(Permission.PRODUCTS_UPDATE)
  @ApiOperation({ summary: 'Update a product by ID' })
  @ApiOkResponse({ type: Product })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProductDto: UpdateProductDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.productsService.update(id, updateProductDto, companyId);
  }

  @Delete(':id')
  @RequirePermissions(Permission.PRODUCTS_DELETE)
  @ApiOperation({ summary: 'Delete a product by ID' })
  @ApiOkResponse({ type: Product })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.productsService.remove(id, companyId);
  }
}
