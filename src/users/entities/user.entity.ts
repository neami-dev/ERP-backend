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
import { ApiHideProperty } from '@nestjs/swagger';
import { Company } from 'src/companies/entities/company.entity';

@Entity('users')
@Unique(['email'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 255,
  })
  email: string;

  /**
   * Bcrypt hash of the user password.
   *
   * `select: false` keeps the hash out of every query result by default,
   * so it can never leak through an API response. The sign-in flow is the
   * only place that loads it, using an explicit `addSelect`.
   *
   * `@ApiHideProperty` keeps it out of the OpenAPI document too: the Swagger
   * plugin reads entity files, and `Company.users` pulls this class into the
   * spec. The API never returns the field, so documenting it would only
   * mislead a generated client.
   */
  @ApiHideProperty()
  @Column({
    type: 'varchar',
    length: 255,
    select: false,
  })
  password: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  firstName: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  lastName?: string;

  @Column({
    type: 'boolean',
    default: true,
  })
  isActive: boolean;

  @ManyToOne(() => Company, (company) => company.users, { nullable: false })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'company_id' })
  companyId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
