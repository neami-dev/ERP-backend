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
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

@ApiTags('inventories')
@Controller('inventories')
export class InventoriesController {
  constructor(private readonly inventoriesService: InventoriesService) { }

  @Post()
  @ApiOperation({ summary: 'Create an inventory record for the current company' })
  create(
    @Body() createInventoryDto: CreateInventoryDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.inventoriesService.create(createInventoryDto, companyId);
  }

  @Get()
  @ApiOperation({ summary: 'Get the inventory records of the current company' })
  findAll(
    @Query() query: PaginationDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.inventoriesService.findAll(query, companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an inventory record by ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.inventoriesService.findOne(id, companyId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Correct the counted quantities of an inventory record' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateInventoryDto: UpdateInventoryDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.inventoriesService.update(id, updateInventoryDto, companyId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an inventory record by ID' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.inventoriesService.remove(id, companyId);
  }
}
