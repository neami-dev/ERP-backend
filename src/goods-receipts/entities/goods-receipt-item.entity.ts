import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { GoodsReceipt } from './goods-receipt.entity';
import { PurchaseOrderItem } from 'src/purchases/entities/purchase-order-item.entity';
import { Product } from 'src/products/entities/product.entity';

@Entity('goods_receipt_items')
export class GoodsReceiptItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'goods_receipt_id', type: 'uuid' })
  goodsReceiptId: string;

  @ManyToOne(() => GoodsReceipt, (goodsReceipt) => goodsReceipt.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'goods_receipt_id' })
  goodsReceipt: GoodsReceipt;

  @Column({ name: 'purchase_order_item_id', type: 'uuid' })
  purchaseOrderItemId: string;

  // RESTRICT: this line is the reason stock moved, so the order line it was
  // received against must stay around at least as long as this receipt does.
  @ManyToOne(() => PurchaseOrderItem, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'purchase_order_item_id' })
  purchaseOrderItem: PurchaseOrderItem;

  // Denormalized from the purchase order item at creation time, never taken
  // from the client, so a receipt still reads correctly even if the order
  // line it points at is ever removed from view.
  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'quantity_received', type: 'integer' })
  quantityReceived: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
