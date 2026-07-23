import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';
import { Product } from 'src/products/entities/product.entity';

@Entity()
export class PurchaseOrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('uuid')
  product_id: string;

  @ManyToOne(() => Product, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column()
  quantity: number;

  @Column()
  unit_cost: number;

  @Column()
  purchase_order_id: number;

  @ManyToOne(
    () => PurchaseOrder,
    (purchaseOrder) => purchaseOrder.items,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PurchaseOrder;


  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}