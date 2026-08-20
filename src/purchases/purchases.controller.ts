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

import { PurchaseOrdersService } from './services/purchase-orders.service';
import { PurchaseOrderItemsService } from './services/purchase-order-items.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { CreatePurchaseOrderItemDto } from './dto/create-purchase-order-item.dto';
import { UpdatePurchaseOrderItemDto } from './dto/update-purchase-order-item.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

@ApiTags('purchases')
@Controller('purchases')
export class PurchasesController {
  constructor(
    private readonly purchaseOrdersService: PurchaseOrdersService,
    private readonly purchaseOrderItemsService: PurchaseOrderItemsService,
  ) { }

  // =============================
  // Purchase Order Endpoints
  // =============================

  @Post()
  @ApiOperation({ summary: 'Create a purchase order for the current company' })
  create(
    @Body() createPurchaseOrderDto: CreatePurchaseOrderDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.purchaseOrdersService.create(createPurchaseOrderDto, companyId);
  }

  @Get()
  @ApiOperation({ summary: 'Get the purchase orders of the current company' })
  findAll(
    @Query() query: PaginationDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.purchaseOrdersService.findAll(query, companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a purchase order by ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.purchaseOrdersService.findOne(id, companyId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a draft purchase order by ID' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePurchaseOrderDto: UpdatePurchaseOrderDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.purchaseOrdersService.update(
      id,
      updatePurchaseOrderDto,
      companyId,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a purchase order by ID' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.purchaseOrdersService.remove(id, companyId);
  }

  @Patch(':id/confirm')
  @ApiOperation({ summary: 'Confirm a draft purchase order' })
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.purchaseOrdersService.confirm(id, companyId);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a purchase order' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.purchaseOrdersService.cancel(id, companyId);
  }

  @Patch(':id/receive')
  @ApiOperation({
    summary: 'Receive a confirmed purchase order into inventory',
  })
  receive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() receivePurchaseOrderDto: ReceivePurchaseOrderDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.purchaseOrdersService.receive(
      id,
      receivePurchaseOrderDto.warehouseId,
      companyId,
    );
  }

  // =============================
  // Purchase Order Items Endpoints
  // =============================

  @Post(':purchaseOrderId/items')
  @ApiOperation({ summary: 'Add an item to a draft purchase order' })
  addItem(
    @Param('purchaseOrderId', ParseUUIDPipe) purchaseOrderId: string,
    @Body() createPurchaseOrderItemDto: CreatePurchaseOrderItemDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.purchaseOrderItemsService.create(
      purchaseOrderId,
      createPurchaseOrderItemDto,
      companyId,
    );
  }

  @Patch(':purchaseOrderId/items/:itemId')
  @ApiOperation({ summary: 'Update an item of a draft purchase order' })
  updateItem(
    @Param('purchaseOrderId', ParseUUIDPipe) purchaseOrderId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdatePurchaseOrderItemDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.purchaseOrderItemsService.update(
      purchaseOrderId,
      itemId,
      dto,
      companyId,
    );
  }

  @Delete(':purchaseOrderId/items/:itemId')
  @ApiOperation({ summary: 'Remove an item from a draft purchase order' })
  removeItem(
    @Param('purchaseOrderId', ParseUUIDPipe) purchaseOrderId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.purchaseOrderItemsService.remove(
      purchaseOrderId,
      itemId,
      companyId,
    );
  }
}
