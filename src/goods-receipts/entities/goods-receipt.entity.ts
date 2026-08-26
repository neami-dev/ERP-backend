import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';

import { PurchaseOrder } from 'src/purchases/entities/purchase-order.entity';
import { Warehouse } from 'src/warehouses/entities/warehouse.entity';
import { Company } from 'src/companies/entities/company.entity';
import { GoodsReceiptItem } from './goods-receipt-item.entity';
import { GoodsReceiptStatus } from '../enums/goods-receipt-status.enum';

@Entity('goods_receipts')
@Index('IDX_GOODS_RECEIPT_COMPANY', ['companyId'])
@Index('IDX_GOODS_RECEIPT_PURCHASE_ORDER', ['purchaseOrderId'])
export class GoodsReceipt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'purchase_order_id', type: 'uuid' })
  purchaseOrderId: string;

  // RESTRICT, not CASCADE: a purchase order that has stock movements
  // pointing back to it must keep the receipts that explain them. See the
  // matching RESTRICT on PurchaseOrderItem.product for the same reason.
  @ManyToOne(() => PurchaseOrder, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PurchaseOrder;

  @Column({ name: 'warehouse_id', type: 'uuid' })
  warehouseId: string;

  @ManyToOne(() => Warehouse, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  /** When the goods physically arrived. Defaults to now, but can be backdated. */
  @Column({
    name: 'received_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  receivedAt: Date;

  @Column({
    type: 'enum',
    enum: GoodsReceiptStatus,
    default: GoodsReceiptStatus.DRAFT,
  })
  status: GoodsReceiptStatus;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @OneToMany(() => GoodsReceiptItem, (item) => item.goodsReceipt, {
    cascade: true,
  })
  items: GoodsReceiptItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
