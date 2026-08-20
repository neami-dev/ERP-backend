import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { ApiPaginatedResponse } from 'src/common/dto/paginated.dto';
import { Warehouse } from './entities/warehouse.entity';

@ApiTags('warehouses')
@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) { }

  @Post()
  @ApiOperation({ summary: 'Create a warehouse for the current company' })
  @ApiCreatedResponse({ type: Warehouse })
  create(
    @Body() createWarehouseDto: CreateWarehouseDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.warehousesService.create(createWarehouseDto, companyId);
  }

  @Get()
  @ApiOperation({ summary: 'Get the warehouses of the current company' })
  @ApiPaginatedResponse(Warehouse)
  findAll(
    @Query() query: PaginationDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.warehousesService.findAll(query, companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a warehouse by ID' })
  @ApiOkResponse({ type: Warehouse })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.warehousesService.findOne(id, companyId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a warehouse by ID' })
  @ApiOkResponse({ type: Warehouse })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateWarehouseDto: UpdateWarehouseDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.warehousesService.update(id, updateWarehouseDto, companyId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a warehouse by ID' })
  @ApiOkResponse({ type: Warehouse })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.warehousesService.remove(id, companyId);
  }
}
