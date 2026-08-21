import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm';
import {
  StockMovement,
  StockMovementType,
} from './entities/stock-movement.entity';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { StockMovementQueryDto } from './dto/stock-movement-query.dto';
import { Product } from 'src/products/entities/product.entity';
import { Warehouse } from 'src/warehouses/entities/warehouse.entity';
import { InventoriesService } from '../inventories/inventories.service';

/**
 * Stock movements are the audit trail of everything that happened to stock.
 * They are written and read, never updated or deleted — correcting a mistake
 * means recording an ADJUSTMENT, not rewriting history.
 *
 * Every method takes the `companyId` of the caller, read from their JWT.
 */
@Injectable()
export class StockMovementsService {
  private readonly logger = new Logger(StockMovementsService.name);

  constructor(
    @InjectRepository(StockMovement)
    private readonly stockMovementRepo: Repository<StockMovement>,
    private readonly inventoriesService: InventoriesService,
  ) { }

  /**
   * Public entry point – creates a movement and persists it atomically.
   *
   * The stock change and the audit record share one transaction, so stock can
   * never move without a movement recording it, and vice versa.
   */
  async create(
    dto: CreateStockMovementDto,
    companyId: string,
  ): Promise<StockMovement> {
    const queryRunner = this.stockMovementRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const movement = await this.processMovement(queryRunner, dto, companyId);
      await queryRunner.commitTransaction();
      return movement;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Core logic – validates deps, delegates inventory mutation,
   * then persists the movement record.
   */
  private async processMovement(
    queryRunner: QueryRunner,
    dto: CreateStockMovementDto,
    companyId: string,
  ): Promise<StockMovement> {
    const {
      type,
      quantity,
      warehouseId,
      productId,
      referenceType,
      referenceId,
      notes,
      unitCost,
    } = dto;

    // -----------------------------------------------------------------
    // 1️⃣  Validate referenced entities, scoped to the caller's company
    // -----------------------------------------------------------------
    const [product, warehouse] = await Promise.all([
      queryRunner.manager.findOneBy(Product, { id: productId, companyId }),
      queryRunner.manager.findOneBy(Warehouse, { id: warehouseId, companyId }),
    ]);

    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }
    if (!warehouse) {
      throw new NotFoundException(`Warehouse ${warehouseId} not found`);
    }

    // An ADJUSTMENT is a manual correction: it may be negative, to take
    // stock away, and it has no source document to point at. Every other
    // type moves a fixed amount and must say where it came from.
    if (type === StockMovementType.ADJUSTMENT) {
      if (quantity === 0) {
        throw new ConflictException('An adjustment of zero changes nothing');
      }
    } else {
      if (quantity <= 0) {
        throw new ConflictException('Quantity must be a positive number');
      }

      if (!referenceId) {
        throw new BadRequestException(
          `referenceId is required for reference type ${referenceType}`,
        );
      }
    }

    // -----------------------------------------------------------------
    // 2️⃣  Mutate inventory (service‑to‑service call)
    // -----------------------------------------------------------------
    await this.inventoriesService.applyMovement(
      queryRunner,
      productId,
      warehouseId,
      companyId,
      type,
      quantity,
    );

    // -----------------------------------------------------------------
    // 3️⃣  Persist the movement (audit) record
    // -----------------------------------------------------------------
    const movement = queryRunner.manager.create(StockMovement, {
      type,
      quantity,
      unitCost,
      referenceType,
      referenceId: referenceId ?? null,
      notes,
      productId,
      warehouseId,
      companyId,
    });

    const savedMovement = await queryRunner.manager.save(movement);
    this.logger.log(
      `Stock movement created: ${type} ${quantity} of product ${productId}`,
    );

    return savedMovement;
  }

  async findAll(query: StockMovementQueryDto, companyId: string) {
    const { page, limit, productId, warehouseId, type } = query;

    const [movements, total] = await this.stockMovementRepo.findAndCount({
      where: {
        companyId,
        ...(productId && { productId }),
        ...(warehouseId && { warehouseId }),
        ...(type && { type }),
      },
      relations: { product: true, warehouse: true },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data: movements,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, companyId: string): Promise<StockMovement> {
    const movement = await this.stockMovementRepo.findOne({
      where: { id, companyId },
      relations: { product: true, warehouse: true },
    });

    if (!movement) {
      throw new NotFoundException(`Stock movement ${id} not found`);
    }

    return movement;
  }
}
