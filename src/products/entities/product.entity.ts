import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';


@Entity("products")
@Index(['name'], { unique: true })
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    unique: true,
    length: 50,
  })
  sku: string;

  @Column({
    length: 255,
  })
  name: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  sellingPrice: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  purchasePrice: number;

  @Column({
    type: 'text',
    nullable: true,
  })
  description?: string;

  //   @OneToMany(() => Inventory, (inventory) => inventory.product)
  //   inventories: Inventory[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}