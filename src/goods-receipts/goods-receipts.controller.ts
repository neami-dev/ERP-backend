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

import { GoodsReceiptsService } from './goods-receipts.service';
import { GoodsReceiptItemsService } from './goods-receipt-items.service';
import {
  CreateGoodsReceiptDto,
  CreateGoodsReceiptItemDto,
} from './dto/create-goods-receipt.dto';
import { UpdateGoodsReceiptDto } from './dto/update-goods-receipt.dto';
import { UpdateGoodsReceiptItemDto } from './dto/update-goods-receipt-item.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { RequirePermissions } from 'src/auth/decorators/require-permissions.decorator';
import { ApiPaginatedResponse } from 'src/common/dto/paginated.dto';
import { Permission } from 'src/common/permissions/permission';
import { GoodsReceipt } from './entities/goods-receipt.entity';
import { GoodsReceiptItem } from './entities/goods-receipt-item.entity';

@ApiTags('goods-receipts')
@Controller('goods-receipts')
export class GoodsReceiptsController {
  constructor(
    private readonly goodsReceiptsService: GoodsReceiptsService,
    private readonly goodsReceiptItemsService: GoodsReceiptItemsService,
  ) {}

  // =============================
  // Goods Receipt Endpoints
  // =============================

  @Post()
  @RequirePermissions(Permission.GOODS_RECEIPTS_CREATE)
  @ApiOperation({
    summary: 'Record a draft goods receipt against a purchase order',
  })
  @ApiCreatedResponse({ type: GoodsReceipt })
  create(
    @Body() createGoodsReceiptDto: CreateGoodsReceiptDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.goodsReceiptsService.create(createGoodsReceiptDto, companyId);
  }

  @Get()
  @RequirePermissions(Permission.GOODS_RECEIPTS_READ)
  @ApiOperation({ summary: 'Get the goods receipts of the current company' })
  @ApiPaginatedResponse(GoodsReceipt)
  findAll(
    @Query() query: PaginationDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.goodsReceiptsService.findAll(query, companyId);
  }

  @Get(':id')
  @RequirePermissions(Permission.GOODS_RECEIPTS_READ)
  @ApiOperation({ summary: 'Get a goods receipt by ID' })
  @ApiOkResponse({ type: GoodsReceipt })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.goodsReceiptsService.findOne(id, companyId);
  }

  @Patch(':id')
  @RequirePermissions(Permission.GOODS_RECEIPTS_UPDATE)
  @ApiOperation({ summary: 'Update a draft goods receipt by ID' })
  @ApiOkResponse({ type: GoodsReceipt })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateGoodsReceiptDto: UpdateGoodsReceiptDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.goodsReceiptsService.update(
      id,
      updateGoodsReceiptDto,
      companyId,
    );
  }

  @Patch(':id/confirm')
  @RequirePermissions(Permission.GOODS_RECEIPTS_CONFIRM)
  @ApiOperation({
    summary:
      'Confirm a draft goods receipt: raises stock and updates the purchase order status',
  })
  @ApiOkResponse({ type: GoodsReceipt })
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.goodsReceiptsService.confirm(id, companyId);
  }

  @Patch(':id/cancel')
  @RequirePermissions(Permission.GOODS_RECEIPTS_CANCEL)
  @ApiOperation({ summary: 'Cancel a draft goods receipt' })
  @ApiOkResponse({ type: GoodsReceipt })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.goodsReceiptsService.cancel(id, companyId);
  }

  // =============================
  // Goods Receipt Items Endpoints
  // =============================

  @Post(':goodsReceiptId/items')
  @RequirePermissions(Permission.GOODS_RECEIPTS_UPDATE)
  @ApiOperation({ summary: 'Add a line to a draft goods receipt' })
  @ApiCreatedResponse({ type: GoodsReceiptItem })
  addItem(
    @Param('goodsReceiptId', ParseUUIDPipe) goodsReceiptId: string,
    @Body() createGoodsReceiptItemDto: CreateGoodsReceiptItemDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.goodsReceiptItemsService.create(
      goodsReceiptId,
      createGoodsReceiptItemDto,
      companyId,
    );
  }

  @Patch(':goodsReceiptId/items/:itemId')
  @RequirePermissions(Permission.GOODS_RECEIPTS_UPDATE)
  @ApiOperation({ summary: 'Update a line of a draft goods receipt' })
  @ApiOkResponse({ type: GoodsReceiptItem })
  updateItem(
    @Param('goodsReceiptId', ParseUUIDPipe) goodsReceiptId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() updateGoodsReceiptItemDto: UpdateGoodsReceiptItemDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.goodsReceiptItemsService.update(
      goodsReceiptId,
      itemId,
      updateGoodsReceiptItemDto,
      companyId,
    );
  }

  @Delete(':goodsReceiptId/items/:itemId')
  @RequirePermissions(Permission.GOODS_RECEIPTS_UPDATE)
  @ApiOperation({ summary: 'Remove a line from a draft goods receipt' })
  @ApiOkResponse({ type: GoodsReceiptItem })
  removeItem(
    @Param('goodsReceiptId', ParseUUIDPipe) goodsReceiptId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.goodsReceiptItemsService.remove(
      goodsReceiptId,
      itemId,
      companyId,
    );
  }
}
