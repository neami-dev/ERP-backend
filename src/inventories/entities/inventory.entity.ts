import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Product } from 'src/products/entities/product.entity';
import { Warehouse } from 'src/warehouses/entities/warehouse.entity';

@Entity('inventories')
@Unique(['product', 'warehouse'])
export class Inventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'integer', default: 0 })
  quantityOnHand: number;

  @Column({ type: 'integer', default: 0 })
  quantityReserved: number;

  @ManyToOne(() => Product, { eager: true })
  product: Product;

  @ManyToOne(() => Warehouse, { eager: true })
  warehouse: Warehouse;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
