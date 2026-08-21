import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

import { Supplier } from 'src/suppliers/entities/supplier.entity';
import { PurchaseOrder } from 'src/purchases/entities/purchase-order.entity';
import { DocumentSequence } from 'src/common/ document-number/document-sequence.entity';
import { User } from 'src/users/entities/user.entity';

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  name: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Supplier, (supplier) => supplier.company)
  suppliers: Supplier[];

  @OneToMany(() => PurchaseOrder, (order) => order.company)
  purchaseOrders: PurchaseOrder[];

  @OneToMany(() => DocumentSequence, (sequence) => sequence.company)
  documentSequences: DocumentSequence[];

  @OneToMany(() => User, (user) => user.company)
  users: User[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}