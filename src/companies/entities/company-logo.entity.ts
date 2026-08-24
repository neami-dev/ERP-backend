import {
  Entity,
  PrimaryColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiHideProperty } from '@nestjs/swagger';
import { Company } from './company.entity';

/**
 * A company's logo, kept off the `companies` row on purpose.
 *
 * The primary key is the company id itself, not a generated one: a foreign
 * key that is also the primary key is the schema enforcing "at most one logo
 * per company" — there is no code path that could create a second row.
 */
@Entity('company_logos')
export class CompanyLogo {
  @PrimaryColumn({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @OneToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  /**
   * The raw image bytes.
   *
   * `select: false` keeps them out of every query by default — the same
   * precedent as `User.password`. Without it, a `find` scoped to this entity
   * would return the bytes on every row, and a stray `relations: { logo: true }`
   * on the company side would pull them along for free.
   *
   * `@ApiHideProperty` keeps the field out of the OpenAPI document, since the
   * Swagger plugin documents entity properties by default and the API never
   * returns this one as JSON.
   */
  @ApiHideProperty()
  @Column({ type: 'bytea', select: false })
  data: Buffer;

  /**
   * The sniffed content type, not the one the client claimed.
   *
   * A client can send SVG bytes labelled `image/png`; SVG is XML that can
   * carry a `<script>` tag, and serving it back from this origin would be
   * stored XSS against an authenticated user. `detectImageType` reads the
   * file's own magic bytes: anything it cannot identify as PNG, JPEG or WebP
   * is refused before this row exists. A claim that merely disagrees with a
   * real, recognised image (JPEG bytes labelled `image/png`) is not an
   * attack — it is corrected silently and the true type is what gets stored.
   */
  @Column({ name: 'content_type', type: 'varchar', length: 60 })
  contentType: string;

  /** Decoded size in bytes, so "how big is it" never requires reading `data`. */
  @Column({ name: 'byte_size', type: 'integer' })
  byteSize: number;

  /** sha256 of `data`, hex-encoded. Used as the `ETag` on `GET`. */
  @Column({ type: 'char', length: 64 })
  checksum: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
