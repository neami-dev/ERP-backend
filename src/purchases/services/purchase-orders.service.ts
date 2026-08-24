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
import { Warehouse } from 'src/warehouses/entities/warehouse.entity';
import { DocumentType } from 'src/common/ document-number/document-type.enum';
import { DocumentNumberService } from 'src/common/ document-number/document-number.service';
import { PurchaseOrderStatus } from '../enums/purchase-order-status.enum';
import {
  StockMovement,
  StockMovementReferenceType,
  StockMovementType,
} from 'src/stock-movements/entities/stock-movement.entity';
import { InventoriesService } from 'src/inventories/inventories.service';
import { today } from 'src/common/utils/calendar-date';
import { removeEntity } from 'src/common/database/remove-entity';

/**
 * Every method takes the `companyId` of the caller, read from their JWT, so an
 * order and everything it points at stay inside one company.
 *
 * Status flow: DRAFT → CONFIRMED → RECEIVED, with CANCELLED reachable from
 * DRAFT or CONFIRMED. Only a DRAFT can be edited.
 */
@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepo: Repository<PurchaseOrder>,
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepo: Repository<Warehouse>,
    private readonly documentNumberService: DocumentNumberService,
    private readonly inventoriesService: InventoriesService,
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

    // A received order is the reason stock exists in the warehouse. Deleting
    // it would break the audit trail that the stock movements point back to.
    if (purchaseOrder.status === PurchaseOrderStatus.RECEIVED) {
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

    if (purchaseOrder.status === PurchaseOrderStatus.RECEIVED) {
      throw new BadRequestException(
        'A received purchase order cannot be cancelled.',
      );
    }

    if (purchaseOrder.status === PurchaseOrderStatus.CANCELLED) {
      throw new BadRequestException('Purchase order is already cancelled.');
    }

    purchaseOrder.status = PurchaseOrderStatus.CANCELLED;

    return await this.purchaseOrderRepo.save(purchaseOrder);
  }

  /**
   * Receives a confirmed order into a warehouse.
   *
   * Everything happens in one transaction: each item raises the stock, each
   * one writes a stock movement, and the order moves to RECEIVED. If any item
   * fails, the whole receipt rolls back — stock never ends up half-updated.
   *
   * The stock itself is changed through `InventoriesService.applyMovement`,
   * which locks the stock row, so two receipts arriving together cannot
   * overwrite each other.
   */
  async receive(
    id: string,
    warehouseId: string,
    companyId: string,
  ): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findOne(id, companyId);

    if (purchaseOrder.status !== PurchaseOrderStatus.CONFIRMED) {
      throw new BadRequestException(
        'Only confirmed purchase orders can be received.',
      );
    }

    if (purchaseOrder.items.length === 0) {
      throw new BadRequestException('Purchase order contains no items.');
    }

    const warehouseExists = await this.warehouseRepo.existsBy({
      id: warehouseId,
      companyId,
    });

    if (!warehouseExists) {
      throw new NotFoundException('Warehouse not found');
    }

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const item of purchaseOrder.items) {
        await this.inventoriesService.applyMovement(
          queryRunner,
          item.productId,
          warehouseId,
          companyId,
          StockMovementType.IN,
          item.quantity,
        );

        const movement = queryRunner.manager.create(StockMovement, {
          productId: item.productId,
          warehouseId,
          companyId,
          type: StockMovementType.IN,
          quantity: item.quantity,
          unitCost: item.unitCost,
          referenceType: StockMovementReferenceType.PURCHASE_ORDER,
          referenceId: purchaseOrder.id,
        });

        await queryRunner.manager.save(movement);
      }

      purchaseOrder.status = PurchaseOrderStatus.RECEIVED;

      await queryRunner.manager.save(purchaseOrder);

      await queryRunner.commitTransaction();

      return purchaseOrder;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
