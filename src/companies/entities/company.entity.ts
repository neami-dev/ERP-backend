import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
  Unique,
  Check,
} from 'typeorm';

import { Supplier } from 'src/suppliers/entities/supplier.entity';
import { PurchaseOrder } from 'src/purchases/entities/purchase-order.entity';
import { DocumentSequence } from 'src/common/ document-number/document-sequence.entity';
import { User } from 'src/users/entities/user.entity';
import { CompanyLogo } from './company-logo.entity';

@Entity('companies')
// The service has always refused a duplicate name, but only in code — two
// concurrent signups could both pass that check. The constraint is what
// actually guarantees it.
@Unique(['name'])
// The DTO already checks both, but `update()` is not the only way a row can be
// written: `create()` takes a plain object, and an import or admin path later
// will not pass through a DTO at all.
@Check('CHK_COMPANY_FISCAL_MONTH', '"fiscalYearStartMonth" BETWEEN 1 AND 12')
@Check('CHK_COMPANY_CURRENCY', `"defaultCurrency" ~ '^[A-Z]{3}$'`)
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

  /**
   * Identifiant Commun de l'Entreprise — 15 digits, required on every Moroccan
   * invoice. Stored, never enforced: a company is created by signup with only
   * a name, so the profile is filled in afterwards.
   */
  @Column({ type: 'varchar', length: 15, nullable: true })
  ice?: string | null;

  /** Identifiant Fiscal (IF), the tax identifier printed beside the ICE. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  taxId?: string | null;

  /**
   * Registre de Commerce number.
   *
   * Meaningless on its own: the number is issued by one specific commercial
   * court, so an invoice prints it with {@link rcCity} — `RC: 123456 – Casablanca`.
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  rcNumber?: string | null;

  /** The commercial court that issued {@link rcNumber}. */
  @Column({ type: 'varchar', length: 80, nullable: true })
  rcCity?: string | null;

  /** CNSS employer affiliation number, used on payroll documents. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  cnss?: string | null;

  /** Taxe professionnelle (patente), the fifth entry in the invoice footer. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  patente?: string | null;

  /**
   * ISO 4217 code every amount in this company is expressed in.
   *
   * A display label, not a conversion: no document carries its own currency,
   * so changing this relabels existing documents without converting them.
   *
   * Restricted to two-decimal currencies. `roundMoney()` rounds to two places
   * and every money column is `numeric(10, 2)`, so a three-decimal currency
   * (TND, KWD) would be silently wrong in its last digit.
   */
  @Column({ type: 'varchar', length: 3, default: 'MAD' })
  defaultCurrency: string;

  /**
   * Month the accounting year opens, 1–12. January for most companies.
   *
   * **Reporting periods only.** Document numbers deliberately use the calendar
   * year — see `DocumentNumberService.format()`, which builds `PO-2026-000001`
   * from the current year. Wiring this into numbering would change how
   * documents are identified, which is a different decision from when the
   * books close.
   */
  @Column({ type: 'smallint', default: 1 })
  fiscalYearStartMonth: number;

  /**
   * Kept in its own table so the bytes cannot be loaded by accident: a company
   * is joined on hot paths (sign-in loads `user.company`), and a logo has no
   * business travelling with them.
   */
  @OneToOne(() => CompanyLogo, (logo) => logo.company)
  logo?: CompanyLogo | null;

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