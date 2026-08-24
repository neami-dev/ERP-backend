import {
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'node:crypto';

import { CompanyLogo } from './entities/company-logo.entity';
import {
  UploadCompanyLogoDto,
  MAX_LOGO_BYTES,
} from './dto/upload-company-logo.dto';
import { detectImageType } from 'src/common/utils/image-type';

/**
 * The logo lives in its own table, `select: false` on the bytes, so it is
 * never a side effect of reading a company. Every write here re-derives
 * `byteSize`, `contentType` and `checksum` from the decoded buffer — none of
 * them are trusted from the request.
 */
@Injectable()
export class CompanyLogosService {
  constructor(
    @InjectRepository(CompanyLogo)
    private readonly logoRepo: Repository<CompanyLogo>,
  ) {}

  /**
   * Replaces the company's logo, creating the row on the first upload.
   *
   * @throws {PayloadTooLargeException} If the decoded image exceeds
   * `MAX_LOGO_BYTES`. The DTO already caps the base64 *string* length, but
   * that is an approximation — whitespace or missing padding shift the
   * ratio, so the decoded byte count is what is actually enforced.
   * @throws {UnprocessableEntityException} If the bytes are not one of the
   * supported image types, whatever the client claimed.
   */
  async upload(
    companyId: string,
    dto: UploadCompanyLogoDto,
  ): Promise<CompanyLogo> {
    const data = Buffer.from(dto.data, 'base64');

    if (data.byteLength > MAX_LOGO_BYTES) {
      throw new PayloadTooLargeException(
        `Logo must be at most ${MAX_LOGO_BYTES / 1024} KB (received ${Math.ceil(
          data.byteLength / 1024,
        )} KB).`,
      );
    }

    // The claimed content type is only ever a hint to the client's own
    // encoder — what is stored is what the bytes actually are.
    const detectedType = detectImageType(data);

    if (!detectedType) {
      throw new UnprocessableEntityException(
        'The uploaded file is not a recognised PNG, JPEG or WebP image.',
      );
    }

    const checksum = createHash('sha256').update(data).digest('hex');

    const logo = this.logoRepo.create({
      companyId,
      data,
      contentType: detectedType,
      byteSize: data.byteLength,
      checksum,
    });

    return await this.logoRepo.save(logo);
  }

  /** Metadata only — never the bytes. Used to answer `GET /companies/me`. */
  async findMetadata(companyId: string): Promise<CompanyLogo | null> {
    return await this.logoRepo.findOneBy({ companyId });
  }

  /**
   * The bytes, explicitly selected past the column's `select: false`.
   *
   * @throws {NotFoundException} If the company has no logo.
   */
  async findBytes(companyId: string): Promise<CompanyLogo> {
    const logo = await this.logoRepo
      .createQueryBuilder('logo')
      .addSelect('logo.data')
      .where('logo.company_id = :companyId', { companyId })
      .getOne();

    if (!logo) {
      throw new NotFoundException('This company has no logo.');
    }

    return logo;
  }

  /** @throws {NotFoundException} If the company has no logo to remove. */
  async remove(companyId: string): Promise<void> {
    const result = await this.logoRepo.delete({ companyId });

    if (result.affected === 0) {
      throw new NotFoundException('This company has no logo.');
    }
  }
}
