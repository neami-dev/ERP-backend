import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { GoodsReceipt } from './entities/goods-receipt.entity';
import { GoodsReceiptItem } from './entities/goods-receipt-item.entity';
import { GoodsReceiptStatus } from './enums/goods-receipt-status.enum';
import { CreateGoodsReceiptDto } from './dto/create-goods-receipt.dto';
import { UpdateGoodsReceiptDto } from './dto/update-goods-receipt.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { PurchaseOrder } from 'src/purchases/entities/purchase-order.entity';
import { PurchaseOrderItem } from 'src/purchases/entities/purchase-order-item.entity';
import { PurchaseOrderStatus } from 'src/purchases/enums/purchase-order-status.enum';
import { Warehouse } from 'src/warehouses/entities/warehouse.entity';
import { InventoriesService } from 'src/inventories/inventories.service';
import {
  StockMovement,
  StockMovementReferenceType,
  StockMovementType,
} from 'src/stock-movements/entities/stock-movement.entity';

/**
 * Every method takes the `companyId` of the caller, read from their JWT, so a
 * receipt and everything it points at stay inside one company.
 *
 * Status flow: DRAFT → CONFIRMED, or DRAFT → CANCELLED. A DRAFT is just a
 * plan and has no effect on stock; only `confirm()` moves anything. Once
 * CONFIRMED, a receipt is permanent — same reasoning as a RECEIVED purchase
 * order not being deletable, it is now the reason stock exists.
 *
 * Confirming is also what keeps `PurchaseOrder.status` honest: it moves the
 * order to PARTIALLY_RECEIVED, or RECEIVED once every line is fully in.
 * `PurchaseOrdersService.receive()` is a separate, manual "mark as received"
 * flag and does not read from receipts at all — see its own doc comment.
 */
@Injectable()
export class GoodsReceiptsService {
  constructor(
    @InjectRepository(GoodsReceipt)
    private readonly goodsReceiptRepo: Repository<GoodsReceipt>,
    @InjectRepository(GoodsReceiptItem)
    private readonly goodsReceiptItemRepo: Repository<GoodsReceiptItem>,
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepo: Repository<PurchaseOrder>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepo: Repository<Warehouse>,
    private readonly inventoriesService: InventoriesService,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    dto: CreateGoodsReceiptDto,
    companyId: string,
  ): Promise<GoodsReceipt> {
    const purchaseOrder = await this.purchaseOrderRepo.findOne({
      where: { id: dto.purchaseOrderId, companyId },
      relations: { items: true },
    });

    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }

    if (
      purchaseOrder.status !== PurchaseOrderStatus.CONFIRMED &&
      purchaseOrder.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED
    ) {
      throw new BadRequestException(
        'Only a confirmed or partially received purchase order can take a goods receipt.',
      );
    }

    const warehouseExists = await this.warehouseRepo.existsBy({
      id: dto.warehouseId,
      companyId,
    });

    if (!warehouseExists) {
      throw new NotFoundException('Warehouse not found');
    }

    const itemsById = new Map(
      purchaseOrder.items.map((item) => [item.id, item]),
    );
    // Only a soft, "did you fat-finger this" check — the quantity limit is
    // enforced for real when the receipt is confirmed, against a locked row.
    // Cloned and updated as we go, so two lines in the same request that
    // target the same order item are checked against each other too, not
    // just against what other receipts already confirmed.
    const committed = new Map(
      await this.getReceivedQuantities(
        this.dataSource.manager,
        purchaseOrder.id,
      ),
    );

    const items = dto.items.map((line) => {
      const orderItem = itemsById.get(line.purchaseOrderItemId);

      if (!orderItem) {
        throw new NotFoundException(
          `Purchase order item ${line.purchaseOrderItemId} not found on this order`,
        );
      }

      const remaining = orderItem.quantity - (committed.get(orderItem.id) ?? 0);

      if (line.quantityReceived > remaining) {
        throw new BadRequestException(
          `Cannot receive ${line.quantityReceived} unit(s) of product ${orderItem.productId}: only ${remaining} remain on the order.`,
        );
      }

      committed.set(
        orderItem.id,
        (committed.get(orderItem.id) ?? 0) + line.quantityReceived,
      );

      return this.goodsReceiptItemRepo.create({
        purchaseOrderItemId: orderItem.id,
        productId: orderItem.productId,
        quantityReceived: line.quantityReceived,
      });
    });

    const goodsReceipt = this.goodsReceiptRepo.create({
      purchaseOrderId: purchaseOrder.id,
      warehouseId: dto.warehouseId,
      companyId,
      notes: dto.notes,
      status: GoodsReceiptStatus.DRAFT,
      items,
      ...(dto.receivedAt ? { receivedAt: new Date(dto.receivedAt) } : {}),
    });

    return await this.goodsReceiptRepo.save(goodsReceipt);
  }

  async findAll(query: PaginationDto, companyId: string) {
    const { page, limit } = query;

    const [goodsReceipts, total] = await this.goodsReceiptRepo.findAndCount({
      where: { companyId },
      relations: { purchaseOrder: true, warehouse: true, items: true },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data: goodsReceipts,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, companyId: string): Promise<GoodsReceipt> {
    const goodsReceipt = await this.goodsReceiptRepo.findOne({
      where: { id, companyId },
      relations: {
        purchaseOrder: true,
        warehouse: true,
        items: { product: true },
      },
    });

    if (!goodsReceipt) {
      throw new NotFoundException('Goods receipt not found');
    }

    return goodsReceipt;
  }

  /**
   * Ensures the receipt is still a DRAFT and may be modified.
   *
   * @throws {NotFoundException} If the receipt does not exist in this company.
   * @throws {BadRequestException} If the receipt has left the DRAFT status.
   */
  async ensureIsDraft(id: string, companyId: string): Promise<GoodsReceipt> {
    const goodsReceipt = await this.findOne(id, companyId);

    if (goodsReceipt.status !== GoodsReceiptStatus.DRAFT) {
      throw new BadRequestException(
        'Only a draft goods receipt can be modified.',
      );
    }

    return goodsReceipt;
  }

  async update(
    id: string,
    dto: UpdateGoodsReceiptDto,
    companyId: string,
  ): Promise<GoodsReceipt> {
    const goodsReceipt = await this.ensureIsDraft(id, companyId);

    if (dto.warehouseId) {
      const warehouseExists = await this.warehouseRepo.existsBy({
        id: dto.warehouseId,
        companyId,
      });

      if (!warehouseExists) {
        throw new NotFoundException('Warehouse not found');
      }
    }

    Object.assign(goodsReceipt, {
      warehouseId: dto.warehouseId ?? goodsReceipt.warehouseId,
      notes: dto.notes ?? goodsReceipt.notes,
      receivedAt: dto.receivedAt
        ? new Date(dto.receivedAt)
        : goodsReceipt.receivedAt,
    });

    return await this.goodsReceiptRepo.save(goodsReceipt);
  }

  async cancel(id: string, companyId: string): Promise<GoodsReceipt> {
    const goodsReceipt = await this.ensureIsDraft(id, companyId);

    goodsReceipt.status = GoodsReceiptStatus.CANCELLED;

    return await this.goodsReceiptRepo.save(goodsReceipt);
  }

  /**
   * Confirms a draft receipt: raises stock for each line, records a stock
   * movement for each, and brings `PurchaseOrder.status` up to date with how
   * much of the order has now actually arrived.
   *
   * Everything happens in one transaction, locking the purchase order row
   * first. The lock is what keeps two receipts against the same order from
   * both reading "3 remain" and both confirming for 3 — the second one waits
   * for the first to commit, then sees the updated total and is rejected if
   * it would overshoot.
   *
   * The stock itself is changed through `InventoriesService.applyMovement`,
   * which locks the stock row for the same reason.
   */
  async confirm(id: string, companyId: string): Promise<GoodsReceipt> {
    const goodsReceipt = await this.ensureIsDraft(id, companyId);

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const purchaseOrder = await queryRunner.manager
        .getRepository(PurchaseOrder)
        .createQueryBuilder('purchaseOrder')
        .setLock('pessimistic_write')
        .where('purchaseOrder.id = :id', { id: goodsReceipt.purchaseOrderId })
        .getOne();

      if (!purchaseOrder) {
        throw new NotFoundException('Purchase order not found');
      }

      const orderItems = await queryRunner.manager.findBy(PurchaseOrderItem, {
        purchaseOrderId: purchaseOrder.id,
      });
      const orderItemsById = new Map(orderItems.map((item) => [item.id, item]));

      const received = await this.getReceivedQuantities(
        queryRunner.manager,
        purchaseOrder.id,
      );

      for (const item of goodsReceipt.items) {
        const orderItem = orderItemsById.get(item.purchaseOrderItemId);

        if (!orderItem) {
          throw new NotFoundException(
            `Purchase order item ${item.purchaseOrderItemId} not found on this order`,
          );
        }

        const remaining =
          orderItem.quantity - (received.get(orderItem.id) ?? 0);

        if (item.quantityReceived > remaining) {
          throw new BadRequestException(
            `Cannot confirm: only ${remaining} unit(s) remain on this order line.`,
          );
        }

        // Updated in place: two lines on this same receipt that target the
        // same order item must be checked against each other too, not just
        // against what was confirmed before this receipt started.
        received.set(
          orderItem.id,
          (received.get(orderItem.id) ?? 0) + item.quantityReceived,
        );

        await this.inventoriesService.applyMovement(
          queryRunner,
          item.productId,
          goodsReceipt.warehouseId,
          companyId,
          StockMovementType.IN,
          item.quantityReceived,
        );

        const movement = queryRunner.manager.create(StockMovement, {
          productId: item.productId,
          warehouseId: goodsReceipt.warehouseId,
          companyId,
          type: StockMovementType.IN,
          quantity: item.quantityReceived,
          unitCost: orderItem.unitCost,
          referenceType: StockMovementReferenceType.GOODS_RECEIPT,
          referenceId: goodsReceipt.id,
        });

        await queryRunner.manager.save(movement);
      }

      goodsReceipt.status = GoodsReceiptStatus.CONFIRMED;

      await queryRunner.manager.save(goodsReceipt);

      const updatedReceived = await this.getReceivedQuantities(
        queryRunner.manager,
        purchaseOrder.id,
      );

      const fullyReceived = orderItems.every(
        (item) => (updatedReceived.get(item.id) ?? 0) >= item.quantity,
      );

      purchaseOrder.status = fullyReceived
        ? PurchaseOrderStatus.RECEIVED
        : PurchaseOrderStatus.PARTIALLY_RECEIVED;

      await queryRunner.manager.save(purchaseOrder);

      await queryRunner.commitTransaction();

      return goodsReceipt;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * How much of one purchase order line has already been confirmed-received,
   * across every CONFIRMED receipt against that order. Used by
   * `GoodsReceiptItemsService` to bound a line being added or edited on a
   * still-DRAFT receipt.
   */
  async getConfirmedReceivedQuantity(
    purchaseOrderItemId: string,
    purchaseOrderId: string,
  ): Promise<number> {
    const received = await this.getReceivedQuantities(
      this.dataSource.manager,
      purchaseOrderId,
    );

    return received.get(purchaseOrderItemId) ?? 0;
  }

  /** Quantity already confirmed-received per purchase order item, on one order. */
  private async getReceivedQuantities(
    manager: EntityManager,
    purchaseOrderId: string,
  ): Promise<Map<string, number>> {
    const rows = await manager
      .createQueryBuilder(GoodsReceiptItem, 'item')
      .innerJoin(GoodsReceipt, 'receipt', 'receipt.id = item.goods_receipt_id')
      .select('item.purchase_order_item_id', 'purchaseOrderItemId')
      .addSelect('SUM(item.quantity_received)', 'total')
      .where('receipt.purchase_order_id = :purchaseOrderId', {
        purchaseOrderId,
      })
      .andWhere('receipt.status = :status', {
        status: GoodsReceiptStatus.CONFIRMED,
      })
      .groupBy('item.purchase_order_item_id')
      .getRawMany<{ purchaseOrderItemId: string; total: string }>();

    return new Map(
      rows.map((row) => [row.purchaseOrderItemId, Number(row.total)]),
    );
  }
}
