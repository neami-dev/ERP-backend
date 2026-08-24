import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { Company } from 'src/companies/entities/company.entity';

@Entity('roles')
// Role names only need to be unique within a company — two companies may
// both have an "Employee" role.
@Unique(['companyId', 'name'])
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  /**
   * The permission strings this role grants — see `src/common/permissions/permission.ts`.
   * Ignored for the owner role: `isOwnerRole` grants everything regardless of
   * what is stored here.
   */
  @Column({ type: 'text', array: true, default: '{}' })
  permissions: string[];

  /**
   * True only for the single role auto-created at signup for a company.
   *
   * It bypasses the permission check entirely (see `PermissionsGuard`), so an
   * owner always has every permission — including ones added to the catalog
   * later — without needing this row's `permissions` kept in sync. The API
   * refuses to edit or delete a role with this flag set.
   */
  @Column({ type: 'boolean', default: false })
  isOwnerRole: boolean;

  @ManyToOne(() => Company, { nullable: false })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'company_id' })
  companyId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
