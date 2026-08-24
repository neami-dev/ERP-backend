import {
  Controller,
  Get,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InventoriesService } from './inventories.service';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { RequirePermissions } from 'src/auth/decorators/require-permissions.decorator';
import { ApiPaginatedResponse } from 'src/common/dto/paginated.dto';
import { Permission } from 'src/common/permissions/permission';
import { Inventory } from './entities/inventory.entity';

/**
 * Stock is read here, never written. Raising, lowering or correcting a count
 * is done with `POST /stock-movements` — that path locks the row, validates
 * the change and leaves an audit record behind, none of which a plain write
 * to this table would do.
 */
@ApiTags('inventories')
@Controller('inventories')
export class InventoriesController {
  constructor(private readonly inventoriesService: InventoriesService) {}

  @Get()
  @RequirePermissions(Permission.INVENTORIES_READ)
  @ApiOperation({ summary: 'Get the inventory records of the current company' })
  @ApiPaginatedResponse(Inventory)
  findAll(
    @Query() query: PaginationDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.inventoriesService.findAll(query, companyId);
  }

  @Get(':id')
  @RequirePermissions(Permission.INVENTORIES_READ)
  @ApiOperation({ summary: 'Get an inventory record by ID' })
  @ApiOkResponse({ type: Inventory })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.inventoriesService.findOne(id, companyId);
  }

  @Delete(':id')
  @RequirePermissions(Permission.INVENTORIES_DELETE)
  @ApiOperation({
    summary: 'Delete an empty stock record',
    description:
      'Only a record holding no stock can be removed. Adjust the count down ' +
      'to zero with a stock movement first.',
  })
  @ApiOkResponse({ type: Inventory })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.inventoriesService.remove(id, companyId);
  }
}
