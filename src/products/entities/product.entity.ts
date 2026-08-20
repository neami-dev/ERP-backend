import { Company } from 'src/companies/entities/company.entity';
import { Category } from 'src/categories/entities/category.entity';
import { Inventory } from 'src/inventories/entities/inventory.entity';
import { decimalTransformer } from 'src/common/transformers/decimal.transformer';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';


@Entity("products")
// Scoped to the company: two companies may each sell a product called
// "iPhone 16", and may each use the SKU "SKU001" in their own catalogue.
@Unique(['company', 'sku'])
@Unique(['company', 'name'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    length: 50,
  })
  sku: string;

  @Column({
    length: 255,
  })
  name: string;

  @Column({
    name: "selling_price",
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  sellingPrice: number;

  @Column({
    name: "purchase_price",
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  purchasePrice: number;

  @Column({
    type: 'text',
    nullable: true,
  })
  description?: string;

  @OneToMany(() => Inventory, (inventory) => inventory.product)
  inventories: Inventory[];

  /** Optional: a product does not have to be filed under a category. */
  @ManyToOne(() => Category, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category: Category | null;

  @Column({ name: 'category_id', nullable: true })
  categoryId: string | null;

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
