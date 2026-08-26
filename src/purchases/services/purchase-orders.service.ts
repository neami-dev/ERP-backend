import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { CreatePurchaseOrderDto } from '../dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from '../dto/update-purchase-order.dto';
import { PurchaseOrder } from '../entities/purchase-order.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { Supplier } from 'src/suppliers/entities/supplier.entity';
import { DocumentType } from 'src/common/ document-number/document-type.enum';
import { DocumentNumberService } from 'src/common/ document-number/document-number.service';
import { PurchaseOrderStatus } from '../enums/purchase-order-status.enum';
import { today } from 'src/common/utils/calendar-date';
import { removeEntity } from 'src/common/database/remove-entity';

/**
 * Every method takes the `companyId` of the caller, read from their JWT, so an
 * order and everything it points at stay inside one company.
 *
 * Status flow: DRAFT → CONFIRMED → (PARTIALLY_RECEIVED →) RECEIVED, with
 * CANCELLED reachable from DRAFT or CONFIRMED. Only a DRAFT can be edited.
 *
 * PARTIALLY_RECEIVED and RECEIVED are normally set by
 * `GoodsReceiptsService.confirm()`, from the quantities actually received
 * against each line. `receive()` here is a separate, manual override — see
 * its own doc comment.
 */
@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepo: Repository<PurchaseOrder>,
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    private readonly documentNumberService: DocumentNumberService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Creates a new purchase order within a database transaction.
   *
   * The order number is generated inside the transaction, because the
   * generator locks the sequence row — if the order then fails to save, the
   * rollback gives the number back instead of leaving a gap.
   *
   * @throws {NotFoundException} If the supplier does not belong to the company.
   */
  async create(
    createPurchaseOrderDto: CreatePurchaseOrderDto,
    companyId: string,
  ) {
    const { supplierId } = createPurchaseOrderDto;

    const supplierExists = await this.supplierRepo.existsBy({
      id: supplierId,
      companyId,
    });

    if (!supplierExists) {
      throw new NotFoundException('Supplier not found');
    }

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const orderNumber = await this.documentNumberService.generate(
        companyId,
        DocumentType.PURCHASE_ORDER,
        queryRunner,
      );

      const purchaseOrder = queryRunner.manager.create(PurchaseOrder, {
        ...createPurchaseOrderDto,
        companyId,
        orderNumber,
        orderDate: today(),
      });

      await queryRunner.manager.save(purchaseOrder);

      await queryRunner.commitTransaction();

      // Built in memory, so the @AfterLoad hook that fills these in never
      // ran. A new order has no lines yet, and the client should not have to
      // treat this one response differently from every other.
      purchaseOrder.items = [];
      purchaseOrder.totalAmount = 0;

      return purchaseOrder;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(query: PaginationDto, companyId: string) {
    const { page, limit } = query;

    const [purchaseOrders, total] = await this.purchaseOrderRepo.findAndCount({
      where: { companyId },
      relations: { supplier: true, items: true },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data: purchaseOrders,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, companyId: string) {
    const purchaseOrder = await this.purchaseOrderRepo.findOne({
      where: { id, companyId },
      relations: { supplier: true, items: { product: true } },
    });

    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }

    return purchaseOrder;
  }

  /**
   * Ensures the purchase order is still a DRAFT and may be modified.
   *
   * @throws {NotFoundException} If the order does not exist in this company.
   * @throws {BadRequestException} If the order has left the DRAFT status.
   */
  async ensureIsDraft(id: string, companyId: string): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findOne(id, companyId);

    if (purchaseOrder.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException(
        'Only draft purchase orders can be modified.',
      );
    }

    return purchaseOrder;
  }

  async update(
    id: string,
    updatePurchaseOrderDto: UpdatePurchaseOrderDto,
    companyId: string,
  ) {
    // A confirmed or received order is a commitment to the supplier and the
    // source of stock that already moved — it must not change underneath.
    const purchaseOrder = await this.ensureIsDraft(id, companyId);

    if (updatePurchaseOrderDto.supplierId) {
      const supplierExists = await this.supplierRepo.existsBy({
        id: updatePurchaseOrderDto.supplierId,
        companyId,
      });

      if (!supplierExists) {
        throw new NotFoundException('Supplier not found');
      }
    }

    Object.assign(purchaseOrder, updatePurchaseOrderDto);

    return await this.purchaseOrderRepo.save(purchaseOrder);
  }

  async remove(id: string, companyId: string) {
    const purchaseOrder = await this.findOne(id, companyId);

    // A (partially) received order is the reason stock exists in the
    // warehouse. Deleting it would break the audit trail that the goods
    // receipts and stock movements point back to.
    if (
      purchaseOrder.status === PurchaseOrderStatus.RECEIVED ||
      purchaseOrder.status === PurchaseOrderStatus.PARTIALLY_RECEIVED
    ) {
      throw new BadRequestException(
        'A received purchase order cannot be deleted. Keep it for the stock history.',
      );
    }

    return await removeEntity(
      this.purchaseOrderRepo,
      purchaseOrder,
      'This purchase order cannot be deleted: other records still reference it.',
    );
  }

  async confirm(id: string, companyId: string): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findOne(id, companyId);

    if (purchaseOrder.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException(
        'Only draft purchase orders can be confirmed.',
      );
    }

    if (purchaseOrder.items.length === 0) {
      throw new BadRequestException(
        'Purchase order must contain at least one item.',
      );
    }

    purchaseOrder.status = PurchaseOrderStatus.CONFIRMED;

    return await this.purchaseOrderRepo.save(purchaseOrder);
  }

  async cancel(id: string, companyId: string): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findOne(id, companyId);

    if (
      purchaseOrder.status === PurchaseOrderStatus.RECEIVED ||
      purchaseOrder.status === PurchaseOrderStatus.PARTIALLY_RECEIVED
    ) {
      throw new BadRequestException(
        'A (partially) received purchase order cannot be cancelled.',
      );
    }

    if (purchaseOrder.status === PurchaseOrderStatus.CANCELLED) {
      throw new BadRequestException('Purchase order is already cancelled.');
    }

    purchaseOrder.status = PurchaseOrderStatus.CANCELLED;

    return await this.purchaseOrderRepo.save(purchaseOrder);
  }

  /**
   * Manually marks an order RECEIVED.
   *
   * This is a plain status flag, not a stock operation: it does not move
   * stock and does not care whether every line has actually arrived. It
   * exists so a user can record "this order is done" for their own tracking
   * even without filing a goods receipt for it.
   *
   * The real, quantity-accurate way to receive stock is
   * `GoodsReceiptsService.confirm()`, which raises stock line by line and
   * drives this same status to PARTIALLY_RECEIVED / RECEIVED on its own.
   */
  async receive(id: string, companyId: string): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findOne(id, companyId);

    if (
      purchaseOrder.status !== PurchaseOrderStatus.CONFIRMED &&
      purchaseOrder.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED
    ) {
      throw new BadRequestException(
        'Only a confirmed or partially received purchase order can be marked as received.',
      );
    }

    purchaseOrder.status = PurchaseOrderStatus.RECEIVED;

    return await this.purchaseOrderRepo.save(purchaseOrder);
  }
}
