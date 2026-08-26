import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { GoodsReceipt } from './entities/goods-receipt.entity';
import { GoodsReceiptItem } from './entities/goods-receipt-item.entity';
import { GoodsReceiptsService } from './goods-receipts.service';
import { CreateGoodsReceiptItemDto } from './dto/create-goods-receipt.dto';
import { UpdateGoodsReceiptItemDto } from './dto/update-goods-receipt-item.dto';
import { PurchaseOrderItem } from 'src/purchases/entities/purchase-order-item.entity';
import { removeEntity } from 'src/common/database/remove-entity';

/**
 * Lines can only be touched while their receipt is still a DRAFT —
 * `ensureIsDraft` also scopes the receipt to the caller's company, so a line
 * can never be added to somebody else's receipt. Once a receipt is
 * CONFIRMED its lines are the reason stock moved, and stay fixed.
 */
@Injectable()
export class GoodsReceiptItemsService {
  constructor(
    @InjectRepository(GoodsReceiptItem)
    private readonly goodsReceiptItemRepo: Repository<GoodsReceiptItem>,
    @InjectRepository(PurchaseOrderItem)
    private readonly purchaseOrderItemRepo: Repository<PurchaseOrderItem>,
    private readonly goodsReceiptsService: GoodsReceiptsService,
  ) {}

  async create(
    goodsReceiptId: string,
    dto: CreateGoodsReceiptItemDto,
    companyId: string,
  ): Promise<GoodsReceiptItem> {
    const goodsReceipt = await this.goodsReceiptsService.ensureIsDraft(
      goodsReceiptId,
      companyId,
    );

    const orderItem = await this.purchaseOrderItemRepo.findOneBy({
      id: dto.purchaseOrderItemId,
      purchaseOrderId: goodsReceipt.purchaseOrderId,
    });

    if (!orderItem) {
      throw new NotFoundException(
        'Purchase order item not found on this order',
      );
    }

    const remaining = await this.remainingQuantity(orderItem, goodsReceipt);

    if (dto.quantityReceived > remaining) {
      throw new BadRequestException(
        `Cannot receive ${dto.quantityReceived} unit(s): only ${remaining} remain on this order line.`,
      );
    }

    const item = this.goodsReceiptItemRepo.create({
      goodsReceiptId,
      purchaseOrderItemId: orderItem.id,
      productId: orderItem.productId,
      quantityReceived: dto.quantityReceived,
    });

    return await this.goodsReceiptItemRepo.save(item);
  }

  async update(
    goodsReceiptId: string,
    itemId: string,
    dto: UpdateGoodsReceiptItemDto,
    companyId: string,
  ): Promise<GoodsReceiptItem> {
    const goodsReceipt = await this.goodsReceiptsService.ensureIsDraft(
      goodsReceiptId,
      companyId,
    );
    const item = await this.findItem(goodsReceiptId, itemId);

    const orderItem = await this.purchaseOrderItemRepo.findOneBy({
      id: item.purchaseOrderItemId,
    });

    if (!orderItem) {
      throw new NotFoundException('Purchase order item not found');
    }

    const remaining = await this.remainingQuantity(
      orderItem,
      goodsReceipt,
      item.id,
    );

    if (dto.quantityReceived > remaining) {
      throw new BadRequestException(
        `Cannot receive ${dto.quantityReceived} unit(s): only ${remaining} remain on this order line.`,
      );
    }

    item.quantityReceived = dto.quantityReceived;

    return await this.goodsReceiptItemRepo.save(item);
  }

  async remove(
    goodsReceiptId: string,
    itemId: string,
    companyId: string,
  ): Promise<GoodsReceiptItem> {
    await this.goodsReceiptsService.ensureIsDraft(goodsReceiptId, companyId);

    const item = await this.findItem(goodsReceiptId, itemId);

    return await removeEntity(
      this.goodsReceiptItemRepo,
      item,
      'This receipt line cannot be deleted: other records still reference it.',
    );
  }

  private async findItem(
    goodsReceiptId: string,
    itemId: string,
  ): Promise<GoodsReceiptItem> {
    const item = await this.goodsReceiptItemRepo.findOneBy({
      id: itemId,
      goodsReceiptId,
    });

    if (!item) {
      throw new NotFoundException('Goods receipt item not found');
    }

    return item;
  }

  /**
   * How much of `orderItem` is still free to receive: what the order allows,
   * minus what other CONFIRMED receipts already took, minus what this same
   * draft receipt already commits on other lines for the same order item.
   * `excludeItemId` leaves out the line being edited, so it is not double
   * counted against itself.
   */
  private async remainingQuantity(
    orderItem: PurchaseOrderItem,
    goodsReceipt: GoodsReceipt,
    excludeItemId?: string,
  ): Promise<number> {
    const confirmedElsewhere =
      await this.goodsReceiptsService.getConfirmedReceivedQuantity(
        orderItem.id,
        orderItem.purchaseOrderId,
      );

    const draftElsewhere = (goodsReceipt.items ?? [])
      .filter(
        (item) =>
          item.purchaseOrderItemId === orderItem.id &&
          item.id !== excludeItemId,
      )
      .reduce((sum, item) => sum + item.quantityReceived, 0);

    return orderItem.quantity - confirmedElsewhere - draftElsewhere;
  }
}
