import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

import { Product } from 'src/products/entities/product.entity';
import { Warehouse } from 'src/warehouses/entities/warehouse.entity';
import { Company } from 'src/companies/entities/company.entity';
import { decimalTransformer } from 'src/common/transformers/decimal.transformer';

export enum StockMovementReferenceType {
  PURCHASE_ORDER = 'PURCHASE_ORDER',
  SALES_ORDER = 'SALES_ORDER',
  RETURN = 'RETURN',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum StockMovementType {
  IN = 'IN',
  OUT = 'OUT',
  RESERVE = 'RESERVE',
  RELEASE = 'RELEASE',
  ADJUSTMENT = 'ADJUSTMENT',
}

@Entity('stock_movements')
@Index('IDX_STOCK_MOVEMENT_PRODUCT', ['productId'])
@Index('IDX_STOCK_MOVEMENT_WAREHOUSE', ['warehouseId'])
@Index('IDX_STOCK_MOVEMENT_CREATED_AT', ['createdAt'])
@Index('IDX_STOCK_MOVEMENT_COMPANY', ['companyId'])
@Index('IDX_STOCK_MOVEMENT_REFERENCE', ['referenceType', 'referenceId'])

export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'company_id',
    type: 'uuid',
  })
  companyId: string;

  @ManyToOne(() => Company, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({
    name: 'product_id',
    type: 'uuid',
  })
  productId: string;

  @ManyToOne(() => Product, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({
    name: 'warehouse_id',
    type: 'uuid',
  })
  warehouseId: string;

  @ManyToOne(() => Warehouse, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;

  @Column({
    type: 'enum',
    enum: StockMovementType,
  })
  type: StockMovementType;

  @Column({
    type: 'integer',
  })
  quantity: number;

  @Column({
    name: 'unit_cost',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  unitCost?: number;

  @Column({
    name: 'reference_type',
    type: 'enum',
    enum: StockMovementReferenceType,
  })
  referenceType: StockMovementReferenceType;

  /** Null only for a manual ADJUSTMENT, which has no source document. */
  @Column({
    name: 'reference_id',
    type: 'uuid',
    nullable: true,
  })
  referenceId: string | null;

  /**
   * True when this OUT collected stock that had been reserved, rather than
   * taking free stock off the shelf.
   *
   * Recorded because the two are the same row otherwise, while their effect
   * differs: a reserved collection lowers `quantityReserved` as well as
   * `quantityOnHand`. Without this flag the history cannot explain why the
   * reservation fell, and the movements no longer replay to the counts.
   *
   * Always false for every type other than OUT.
   */
  @Column({ name: 'from_reservation', type: 'boolean', default: false })
  fromReservation: boolean;

  @Column({
    type: 'text',
    nullable: true,
  })
  notes?: string;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt: Date;
}