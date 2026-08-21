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
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { StockMovementType } from 'src/stock-movements/entities/stock-movement.entity';

/**
 * Every method takes the `companyId` of the caller, read from their JWT.
 * Stock rows, the products they point at, and the warehouses they sit in must
 * all belong to that same company.
 */
@Injectable()
export class InventoriesService {
  private readonly logger = new Logger(InventoriesService.name);

  constructor(
    @InjectRepository(Inventory)
    private readonly inventoryRepo: Repository<Inventory>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepo: Repository<Warehouse>,
  ) { }

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
          throw new ConflictException('RESERVE movement quantity must be positive');
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
          throw new ConflictException('RELEASE movement quantity must be positive');
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

  async create(createInventoryDto: CreateInventoryDto, companyId: string) {
    const { productId, warehouseId } = createInventoryDto;

    await this.assertProductAndWarehouseBelongToCompany(
      productId,
      warehouseId,
      companyId,
    );

    const existingInventory = await this.inventoryRepo.existsBy({
      productId,
      warehouseId,
    });

    if (existingInventory) {
      throw new ConflictException(
        'Inventory already exists for this product and warehouse',
      );
    }

    const quantityOnHand = createInventoryDto.quantityOnHand ?? 0;
    const quantityReserved = createInventoryDto.quantityReserved ?? 0;

    if (quantityReserved > quantityOnHand) {
      throw new ConflictException(
        'Reserved quantity cannot be greater than the quantity on hand',
      );
    }

    const inventory = this.inventoryRepo.create({
      productId,
      warehouseId,
      companyId,
      quantityOnHand,
      quantityReserved,
    });

    return await this.inventoryRepo.save(inventory);
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
   * Corrects the counted quantities of an existing stock row.
   *
   * The product and the warehouse cannot be changed: that would silently move
   * stock from one shelf to another with no trace. Delete the row and create
   * the right one instead.
   */
  async update(
    id: string,
    updateInventoryDto: UpdateInventoryDto,
    companyId: string,
  ) {
    const inventory = await this.findOne(id, companyId);

    if (updateInventoryDto.quantityOnHand !== undefined) {
      inventory.quantityOnHand = updateInventoryDto.quantityOnHand;
    }

    if (updateInventoryDto.quantityReserved !== undefined) {
      inventory.quantityReserved = updateInventoryDto.quantityReserved;
    }

    if (inventory.quantityReserved > inventory.quantityOnHand) {
      throw new ConflictException(
        'Reserved quantity cannot be greater than the quantity on hand',
      );
    }

    return await this.inventoryRepo.save(inventory);
  }

  async remove(id: string, companyId: string) {
    const inventory = await this.findOne(id, companyId);

    // TypeORM's remove() strips the primary key off the returned
    // entity, so the id is put back for the client.
    const removed = await this.inventoryRepo.remove(inventory);

    return { ...removed, id };
  }

  private async assertProductAndWarehouseBelongToCompany(
    productId: string,
    warehouseId: string,
    companyId: string,
  ) {
    const productExists = await this.productRepo.existsBy({
      id: productId,
      companyId,
    });

    if (!productExists) {
      throw new NotFoundException('Product not found');
    }

    const warehouseExists = await this.warehouseRepo.existsBy({
      id: warehouseId,
      companyId,
    });

    if (!warehouseExists) {
      throw new NotFoundException('Warehouse not found');
    }
  }
}
