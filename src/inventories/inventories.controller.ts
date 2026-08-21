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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InventoriesService } from './inventories.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@ApiTags('inventories')
@Controller('inventories')
export class InventoriesController {
  constructor(private readonly inventoriesService: InventoriesService) {}

  @Post()
  @ApiOperation({ summary: 'Create an inventory record' })
  create(@Body() createInventoryDto: CreateInventoryDto) {
    return this.inventoriesService.create(createInventoryDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all inventory records' })
  findAll(@Query() query: PaginationDto) {
    return this.inventoriesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an inventory record by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoriesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an inventory record by ID' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateInventoryDto: UpdateInventoryDto,
  ) {
    return this.inventoriesService.update(id, updateInventoryDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an inventory record by ID' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoriesService.remove(id);
  }
}
