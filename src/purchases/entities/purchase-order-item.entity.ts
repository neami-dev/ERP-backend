import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';
import { Product } from 'src/products/entities/product.entity';
import { decimalTransformer } from 'src/common/transformers/decimal.transformer';

@Entity('purchase_order_items')
export class PurchaseOrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'product_id',
    type: 'uuid',
  })
  productId: string;

  // RESTRICT, not CASCADE: with CASCADE, deleting a product silently emptied
  // the lines of every order it appeared on — the order stayed DRAFT and just
  // got cheaper, with no error and no trace. The database now refuses, and
  // `removeEntity` turns that refusal into a 409 the user can act on.
  @ManyToOne(() => Product, {
    onDelete: 'RESTRICT',
    nullable: false,
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column()
  quantity: number;

  @Column({
    name: 'unit_cost',
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  unitCost: number;

  @Column({
    name: 'purchase_order_id',
    type: 'uuid',
  })
  purchaseOrderId: string;
  @ManyToOne(() => PurchaseOrder, (purchaseOrder) => purchaseOrder.items, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PurchaseOrder;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
