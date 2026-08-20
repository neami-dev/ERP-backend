import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm';
import { StockMovement } from './entities/stock-movement.entity';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { Product } from 'src/products/entities/product.entity';
import { Warehouse } from 'src/warehouses/entities/warehouse.entity';
import { Company } from 'src/companies/entities/company.entity';
import { InventoriesService } from '../inventories/inventories.service';

@Injectable()
export class StockMovementsService {
  private readonly logger = new Logger(StockMovementsService.name);

  constructor(
    @InjectRepository(StockMovement)
    private readonly stockMovementRepo: Repository<StockMovement>,
    private readonly inventoriesService: InventoriesService,
  ) {}

  /**
   * Public entry point – creates a movement and persists it atomically.
   */
  async create(dto: CreateStockMovementDto): Promise<StockMovement> {
    const queryRunner = this.stockMovementRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const movement = await this.processMovement(queryRunner, dto);
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
  ): Promise<StockMovement> {
    const {
      type,
      quantity,
      warehouseId,
      productId,
      companyId,
      referenceType,
      referenceId,
      notes,
      unitCost,
    } = dto;

    // -----------------------------------------------------------------
    // 1️⃣  Validate referenced entities
    // -----------------------------------------------------------------
    const [product, warehouse, company] = await Promise.all([
      queryRunner.manager.findOneBy(Product, { id: productId }),
      queryRunner.manager.findOneBy(Warehouse, { id: warehouseId }),
      queryRunner.manager.findOneBy(Company, { id: companyId }),
    ]);

    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }
    if (!warehouse) throw new NotFoundException(`Warehouse ${warehouseId} not found`);
    if (!company) throw new NotFoundException(`Company ${companyId} not found`);
    if (quantity <= 0) {
      throw new ConflictException('Quantity must be a positive number');
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
      type: type,
      quantity: quantity,
      unitCost,
      referenceType,
      referenceId,
      notes,
      product,
      warehouse,
      company,
    });

    const savedMovement = await queryRunner.manager.save(movement);
    this.logger.log(
      `Stock movement created: ${type} ${quantity} of product ${productId}`,
    );

    return savedMovement;
  }

  async findAll(): Promise<StockMovement[]> {
    return this.stockMovementRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<StockMovement> {
    const movement = await this.stockMovementRepo.findOneBy({ id });
    if (!movement) {
      throw new NotFoundException(`Stock movement ${id} not found`);
    }
    return movement;
  }
}