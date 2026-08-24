import {
  NotFoundException,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Repository } from 'typeorm';

import { CompanyLogosService } from './company-logos.service';
import { CompanyLogo } from './entities/company-logo.entity';
import {
  UploadCompanyLogoDto,
  MAX_LOGO_BYTES,
} from './dto/upload-company-logo.dto';

const COMPANY_ID = '33333333-3333-4333-8333-333333333333';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff, 0xe0];

/** A minimal, real PNG signature padded to an arbitrary size. */
function pngBuffer(totalBytes = 32): Buffer {
  return Buffer.concat([
    Buffer.from(PNG_SIGNATURE),
    Buffer.alloc(totalBytes - PNG_SIGNATURE.length),
  ]);
}

function jpegBuffer(totalBytes = 32): Buffer {
  return Buffer.concat([
    Buffer.from(JPEG_SIGNATURE),
    Buffer.alloc(totalBytes - JPEG_SIGNATURE.length),
  ]);
}

function toDto(
  buffer: Buffer,
  contentType: UploadCompanyLogoDto['contentType'],
) {
  return {
    contentType,
    data: buffer.toString('base64'),
  };
}

describe('CompanyLogosService', () => {
  let service: CompanyLogosService;
  let saved: Partial<CompanyLogo>[];
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    findOneBy: jest.Mock;
    createQueryBuilder: jest.Mock;
    delete: jest.Mock;
  };
  let queryBuilder: {
    addSelect: jest.Mock;
    where: jest.Mock;
    getOne: jest.Mock;
  };

  beforeEach(() => {
    saved = [];

    queryBuilder = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };

    repo = {
      create: jest.fn((data: object) => ({ ...data })),
      save: jest.fn((row: Partial<CompanyLogo>) => {
        saved.push(row);
        return Promise.resolve(row);
      }),
      findOneBy: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      delete: jest.fn(),
    };

    service = new CompanyLogosService(
      repo as unknown as Repository<CompanyLogo>,
    );
  });

  describe('upload', () => {
    it('stores a valid PNG under its sniffed type, with a real checksum', async () => {
      const buffer = pngBuffer(1024);

      const result = await service.upload(
        COMPANY_ID,
        toDto(buffer, 'image/png'),
      );

      expect(result.companyId).toBe(COMPANY_ID);
      expect(result.contentType).toBe('image/png');
      expect(result.byteSize).toBe(1024);
      expect(result.checksum).toHaveLength(64);
      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('rejects a decoded payload over the byte limit', async () => {
      // One byte past the limit — and, for this exact byte count, encodes
      // to a base64 string the DTO's own length check would accept (see
      // upload-company-logo.dto.spec.ts). Calling the service directly, as
      // every test in this file does, is what proves this check is real and
      // not just relying on the DTO already having caught it.
      const buffer = pngBuffer(MAX_LOGO_BYTES + 1);

      await expect(
        service.upload(COMPANY_ID, toDto(buffer, 'image/png')),
      ).rejects.toBeInstanceOf(PayloadTooLargeException);

      expect(repo.save).not.toHaveBeenCalled();
    });

    it('accepts exactly the byte limit', async () => {
      const buffer = pngBuffer(MAX_LOGO_BYTES);

      await expect(
        service.upload(COMPANY_ID, toDto(buffer, 'image/png')),
      ).resolves.toMatchObject({ byteSize: MAX_LOGO_BYTES });
    });

    it('rejects bytes it cannot identify as an image, whatever the claim', async () => {
      // The attack this exists to close: XML that could carry a <script>,
      // sent with a content type that looks harmless.
      const svg = Buffer.from('<svg><script>alert(1)</script></svg>');

      await expect(
        service.upload(COMPANY_ID, toDto(svg, 'image/png')),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      expect(repo.save).not.toHaveBeenCalled();
    });

    it('stores the sniffed type when it disagrees with a valid claim', async () => {
      // A real, recognised image under the wrong label is not an attack —
      // only bytes that aren't any known image type are refused.
      const buffer = jpegBuffer(64);

      const result = await service.upload(
        COMPANY_ID,
        toDto(buffer, 'image/png'),
      );

      expect(result.contentType).toBe('image/jpeg');
    });

    it('produces the same checksum for the same bytes', async () => {
      const buffer = pngBuffer(256);

      const first = await service.upload(
        COMPANY_ID,
        toDto(buffer, 'image/png'),
      );
      const second = await service.upload(
        COMPANY_ID,
        toDto(buffer, 'image/png'),
      );

      expect(first.checksum).toBe(second.checksum);
    });

    it('produces a different checksum for different bytes', async () => {
      const first = await service.upload(
        COMPANY_ID,
        toDto(pngBuffer(64), 'image/png'),
      );
      const second = await service.upload(
        COMPANY_ID,
        toDto(pngBuffer(128), 'image/png'),
      );

      expect(first.checksum).not.toBe(second.checksum);
    });
  });

  describe('findMetadata', () => {
    it('reads through the plain repository, not the bytes query', async () => {
      repo.findOneBy.mockResolvedValue({
        companyId: COMPANY_ID,
        contentType: 'image/png',
      });

      const result = await service.findMetadata(COMPANY_ID);

      expect(repo.findOneBy).toHaveBeenCalledWith({ companyId: COMPANY_ID });
      expect(result?.contentType).toBe('image/png');
    });

    it('returns null when there is no logo', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.findMetadata(COMPANY_ID)).resolves.toBeNull();
    });
  });

  describe('findBytes', () => {
    it('explicitly selects the column that defaults to hidden', async () => {
      queryBuilder.getOne.mockResolvedValue({
        companyId: COMPANY_ID,
        data: Buffer.from('x'),
      });

      await service.findBytes(COMPANY_ID);

      expect(queryBuilder.addSelect).toHaveBeenCalledWith('logo.data');
    });

    it('throws 404 when the company has no logo', async () => {
      queryBuilder.getOne.mockResolvedValue(null);

      await expect(service.findBytes(COMPANY_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('succeeds when a row was actually deleted', async () => {
      repo.delete.mockResolvedValue({ affected: 1 });

      await expect(service.remove(COMPANY_ID)).resolves.toBeUndefined();
    });

    it('throws 404 when there was nothing to delete', async () => {
      repo.delete.mockResolvedValue({ affected: 0 });

      await expect(service.remove(COMPANY_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
