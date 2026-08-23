import {
  ConflictException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm';
import { Inventory } from './entities/inventory.entity';
import { Product } from 'src/products/entities/product.entity';
import { Warehouse } from 'src/warehouses/entities/warehouse.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { StockMovementType } from 'src/stock-movements/entities/stock-movement.entity';
import { removeEntity } from 'src/common/database/remove-entity';

/**
 * Every method takes the `companyId` of the caller, read from their JWT.
 * Stock rows, the products they point at, and the warehouses they sit in must
 * all belong to that same company.
 *
 * Stock is **read** here and **written** only through `applyMovement`, which
 * every caller reaches by recording a stock movement. There is deliberately no
 * endpoint that sets a quantity directly: one that did would move stock with
 * nothing in the audit trail to explain it, and would skip the row lock that
 * keeps two concurrent movements from overwriting each other. To correct a
 * count, post a stock movement of type ADJUSTMENT.
 */
@Injectable()
export class InventoriesService {
  private readonly logger = new Logger(InventoriesService.name);

  constructor(
    @InjectRepository(Inventory)
    private readonly inventoryRepo: Repository<Inventory>,
  ) {}

  /**
   * Service-to-service contract: applies the correct business-logic
   * inventory mutation based on the stock movement type.
   *
   * Must be called inside a shared transaction (QueryRunner) so that
   * the caller can commit/rollback together with its own writes.
   *
   * The stock row is locked FOR UPDATE before it is read. Without that lock
   * two concurrent receipts both read the same `quantityOnHand`, both add
   * their amount to that stale number, and the second save overwrites the
   * first — stock silently goes missing.
   */
  async applyMovement(
    queryRunner: QueryRunner,
    productId: string,
    warehouseId: string,
    companyId: string,
    type: StockMovementType,
    quantity: number,
  ): Promise<void> {
    // 1. Load the stock row, locked, or create it if this is the first movement
    let inventory = await queryRunner.manager
      .getRepository(Inventory)
      .createQueryBuilder('inventory')
      .setLock('pessimistic_write')
      .where('inventory.product_id = :productId', { productId })
      .andWhere('inventory.warehouse_id = :warehouseId', { warehouseId })
      .andWhere('inventory.company_id = :companyId', { companyId })
      .getOne();

    if (!inventory) {
      const product = await queryRunner.manager.findOneBy(Product, {
        id: productId,
        companyId,
      });

      if (!product) {
        throw new NotFoundException(`Product ${productId} not found`);
      }

      const warehouse = await queryRunner.manager.findOneBy(Warehouse, {
        id: warehouseId,
        companyId,
      });

      if (!warehouse) {
        throw new NotFoundException(`Warehouse ${warehouseId} not found`);
      }

      inventory = queryRunner.manager.create(Inventory, {
        productId,
        warehouseId,
        companyId,
        quantityOnHand: 0,
        quantityReserved: 0,
      });
      await queryRunner.manager.save(inventory);
    }

    const available = inventory.quantityOnHand - inventory.quantityReserved;

    // 2. Core business logic per movement type
    switch (type) {
      case StockMovementType.IN:
        if (quantity <= 0) {
          throw new ConflictException('IN movement quantity must be positive');
        }
        inventory.quantityOnHand += quantity;
        break;

      case StockMovementType.OUT:
        if (quantity <= 0) {
          throw new ConflictException('OUT movement quantity must be positive');
        }
        if (available < quantity) {
          throw new ConflictException(
            `Insufficient available stock (available: ${available}, requested: ${quantity})`,
          );
        }
        inventory.quantityOnHand -= quantity;
        break;

      case StockMovementType.RESERVE:
        if (quantity <= 0) {
          throw new ConflictException(
            'RESERVE movement quantity must be positive',
          );
        }
        if (available < quantity) {
          throw new ConflictException(
            `Insufficient available stock to reserve (available: ${available}, requested: ${quantity})`,
          );
        }
        inventory.quantityReserved += quantity;
        break;

      case StockMovementType.RELEASE:
        if (quantity <= 0) {
          throw new ConflictException(
            'RELEASE movement quantity must be positive',
          );
        }
        if (inventory.quantityReserved < quantity) {
          throw new ConflictException(
            `Insufficient reserved stock to release (reserved: ${inventory.quantityReserved}, requested: ${quantity})`,
          );
        }
        inventory.quantityReserved -= quantity;
        break;

      case StockMovementType.ADJUSTMENT: {
        // Corrects on-hand up or down. Refuses instead of clamping: silently
        // rewriting a bad adjustment to 0 hides the mistake, and the stock
        // movement record would then not match what actually happened.
        const adjusted = inventory.quantityOnHand + quantity;

        if (adjusted < 0) {
          throw new ConflictException(
            `Adjustment would make stock negative (on hand: ${inventory.quantityOnHand}, adjustment: ${quantity})`,
          );
        }

        if (adjusted < inventory.quantityReserved) {
          throw new ConflictException(
            `Adjustment would leave less stock than is reserved (reserved: ${inventory.quantityReserved}, resulting stock: ${adjusted})`,
          );
        }

        inventory.quantityOnHand = adjusted;
        break;
      }

      default:
        throw new ConflictException(
          `Unsupported movement type: ${type}. Allowed: IN, OUT, RESERVE, RELEASE, ADJUSTMENT`,
        );
    }

    // 3. Persist updated inventory
    await queryRunner.manager.save(inventory);

    this.logger.log(
      `Inventory updated for product ${productId} at warehouse ${warehouseId}: ${type} ${quantity}`,
    );
  }

  /**
   * Get available stock for a product at a warehouse.
   * available = quantityOnHand - quantityReserved
   */
  async getAvailableStock(
    productId: string,
    warehouseId: string,
    companyId: string,
  ): Promise<number> {
    const inventory = await this.inventoryRepo.findOneBy({
      productId,
      warehouseId,
      companyId,
    });

    if (!inventory) {
      return 0;
    }

    return inventory.quantityOnHand - inventory.quantityReserved;
  }

  /**
   * Get full inventory details for a product at a warehouse.
   */
  async getInventoryDetails(
    productId: string,
    warehouseId: string,
    companyId: string,
  ): Promise<{
    quantityOnHand: number;
    quantityReserved: number;
    available: number;
  } | null> {
    const inventory = await this.inventoryRepo.findOneBy({
      productId,
      warehouseId,
      companyId,
    });

    if (!inventory) {
      return null;
    }

    return {
      quantityOnHand: inventory.quantityOnHand,
      quantityReserved: inventory.quantityReserved,
      available: inventory.quantityOnHand - inventory.quantityReserved,
    };
  }

  async findAll(query: PaginationDto, companyId: string) {
    const { page, limit } = query;

    const [inventories, total] = await this.inventoryRepo.findAndCount({
      where: { companyId },
      relations: { product: true, warehouse: true },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data: inventories,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, companyId: string) {
    const inventory = await this.inventoryRepo.findOne({
      where: { id, companyId },
      relations: { product: true, warehouse: true },
    });

    if (!inventory) {
      throw new NotFoundException('Inventory not found');
    }

    return inventory;
  }

  /**
   * Removes an empty stock row — the product is no longer kept in that
   * warehouse at all.
   *
   * A row still holding or reserving stock is refused: deleting it would make
   * the stock vanish with nothing in the movement history to explain it. Book
   * an ADJUSTMENT down to zero first, and the count stays auditable.
   */
  async remove(id: string, companyId: string) {
    const inventory = await this.findOne(id, companyId);

    if (inventory.quantityOnHand !== 0 || inventory.quantityReserved !== 0) {
      throw new ConflictException(
        'This stock record still holds stock. Adjust it down to zero before deleting it.',
      );
    }

    return await removeEntity(
      this.inventoryRepo,
      inventory,
      'This stock record cannot be deleted: other records still reference it.',
    );
  }
}
