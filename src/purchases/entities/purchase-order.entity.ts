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

  /**
   * Calendar date, `YYYY-MM-DD`. Deliberately **not** a timestamp: the day an
   * order was placed has no meaningful time of day, and storing one would
   * shift the date across timezones.
   *
   * Typed as `string` because that is what a Postgres `date` column really
   * returns — calling it a `Date` was a lie the compiler could not catch.
   *
   * On the client, do not do `new Date("2026-08-20")`: that parses as UTC
   * midnight and shows the previous day west of UTC. Keep it as a string, or
   * split it into parts before building a Date.
   */
  @Column({ name: "order_date", type: 'date' })
  orderDate: string;

  /** Calendar date, `YYYY-MM-DD`. See {@link orderDate}. */
  @Column({ name: "expected_date", type: 'date', nullable: true })
  expectedDate?: string | null;

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
