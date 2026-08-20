import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) { }

  @Post()
  @ApiOperation({ summary: 'Create a product for the current company' })
  create(
    @Body() createProductDto: CreateProductDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.productsService.create(createProductDto, companyId);
  }

  @Get()
  @ApiOperation({ summary: 'Get the products of the current company' })
  findAll(
    @Query() query: ProductQueryDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.productsService.findAll(query, companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a product by ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.productsService.findOne(id, companyId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a product by ID' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProductDto: UpdateProductDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.productsService.update(id, updateProductDto, companyId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a product by ID' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.productsService.remove(id, companyId);
  }
}
