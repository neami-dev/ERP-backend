import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseUUIDPipe } from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { ApiOperation } from '@nestjs/swagger';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) { }

  @Post()
  @ApiOperation({
    summary: 'Create a warehouse',
  })
  create(@Body() createWarehouseDto: CreateWarehouseDto) {
    return this.warehousesService.create(createWarehouseDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all warehouses',
  })
  findAll(@Query() query: PaginationDto) {
    return this.warehousesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a warehouse by ID',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.warehousesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a warehouse by ID',
  })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateWarehouseDto: UpdateWarehouseDto) {
    return this.warehousesService.update(id, updateWarehouseDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a warehouse by ID',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.warehousesService.remove(id);
  }
}