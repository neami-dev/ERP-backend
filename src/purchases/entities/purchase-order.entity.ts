import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Supplier } from 'src/suppliers/entities/supplier.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';
import { PurchaseOrderStatus } from '../enums/purchase-order-status.enum';
import { Company } from 'src/companies/entities/company.entity';

@Entity('purchase_orders')
@Unique('UQ_COMPANY_ORDER_NUMBER', [
  'company',
  'orderNumber',
]) @Index('IDX_PURCHASE_ORDER_COMPANY', ['company'])
export class PurchaseOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: "supplier_id",
    type: "uuid"
  })
  supplierId: string;

  @ManyToOne(() => Supplier, (supplier) => supplier.purchaseOrders, { nullable: false })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ name: "order_number", type: 'varchar', length: 100 })
  orderNumber: string;

  @Column({
    type: 'enum',
    enum: PurchaseOrderStatus,
    default: PurchaseOrderStatus.DRAFT,
  })
  status: PurchaseOrderStatus;

  @Column({ name: "order_date", type: 'date' })
  orderDate: Date;

  @Column({ name: "expected_date", type: 'date', nullable: true })
  expectedDate?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @OneToMany(
    () => PurchaseOrderItem,
    (item) => item.purchaseOrder,
    {
      cascade: true,
    },
  )
  items: PurchaseOrderItem[];

  @ManyToOne(() => Company, (company) => company.purchaseOrders, { nullable: false })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'company_id' })
  companyId: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
