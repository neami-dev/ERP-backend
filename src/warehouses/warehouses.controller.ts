import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

@ApiTags('warehouses')
@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) { }

  @Post()
  @ApiOperation({ summary: 'Create a warehouse for the current company' })
  create(
    @Body() createWarehouseDto: CreateWarehouseDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.warehousesService.create(createWarehouseDto, companyId);
  }

  @Get()
  @ApiOperation({ summary: 'Get the warehouses of the current company' })
  findAll(
    @Query() query: PaginationDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.warehousesService.findAll(query, companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a warehouse by ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.warehousesService.findOne(id, companyId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a warehouse by ID' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateWarehouseDto: UpdateWarehouseDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.warehousesService.update(id, updateWarehouseDto, companyId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a warehouse by ID' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.warehousesService.remove(id, companyId);
  }
}
