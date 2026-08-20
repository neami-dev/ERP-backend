import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  JoinColumn,
  Index,
} from 'typeorm';
import { Product } from 'src/products/entities/product.entity';
import { Warehouse } from 'src/warehouses/entities/warehouse.entity';
import { Company } from 'src/companies/entities/company.entity';

@Entity('inventories')
// One stock row per product per warehouse. Product and warehouse are already
// company-scoped, so this pair is unique inside a company by construction.
@Unique(['product', 'warehouse'])
@Index('IDX_INVENTORY_COMPANY', ['company'])
export class Inventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: "quantity_on_hand", type: 'integer', default: 0 })
  quantityOnHand: number;

  @Column({ name: "quantity_reserved", type: 'integer', default: 0 })
  quantityReserved: number;

  @ManyToOne(() => Product, { nullable: false })
  @JoinColumn({ name: "product_id" })
  product: Product;

  @Column({ name: 'product_id' })
  productId: string;

  @ManyToOne(() => Warehouse, { nullable: false })
  @JoinColumn({ name: "warehouse_id" })
  warehouse: Warehouse;

  @Column({ name: 'warehouse_id' })
  warehouseId: string;

  @ManyToOne(() => Company, { nullable: false })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'company_id' })
  companyId: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
