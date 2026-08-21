import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PurchaseOrder } from 'src/purchases/entities/purchase-order.entity';
import { Company } from 'src/companies/entities/company.entity';

@Entity('suppliers')
// Scoped to the company: two different companies may each have a supplier
// with the same name or email.
@Unique(['company', 'email'])
@Unique(['company', 'name'])
export class Supplier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 255,
  })
  name: string;

  @Column({
    type: 'varchar',
    length: 255,
  })
  email: string;

  @Column({
    type: 'varchar',
    length: 50,
  })
  phone: string;

  @Column({
    type: 'text',
  })
  address: string;

  @Column({
    type: 'boolean',
    default: true,
  })
  isActive: boolean;

  @ManyToOne(() => Company, (company) => company.suppliers, { nullable: false })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'company_id' })
  companyId: string;

  @OneToMany(() => PurchaseOrder, (purchaseOrder) => purchaseOrder.supplier)
  purchaseOrders: PurchaseOrder[]; 

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}