import { ConflictException, ForbiddenException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';

import { CompaniesService } from './companies.service';
import { Company } from './entities/company.entity';
import { DocumentNumberService } from 'src/common/ document-number/document-number.service';

const COMPANY_ID = '33333333-3333-4333-8333-333333333333';

function fakeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: COMPANY_ID,
    name: 'Acme',
    isActive: true,
    defaultCurrency: 'MAD',
    fiscalYearStartMonth: 1,
    logo: null,
    ...overrides,
  } as Company;
}

describe('CompaniesService', () => {
  let service: CompaniesService;
  let repo: {
    createQueryBuilder: jest.Mock;
    save: jest.Mock;
    existsBy: jest.Mock;
  };
  let queryBuilder: {
    leftJoinAndSelect: jest.Mock;
    where: jest.Mock;
    getOne: jest.Mock;
  };

  beforeEach(() => {
    queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };

    repo = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      save: jest.fn((row: Company) => Promise.resolve(row)),
      existsBy: jest.fn().mockResolvedValue(false),
    };

    service = new CompaniesService(
      repo as unknown as Repository<Company>,
      {} as DocumentNumberService,
    );
  });

  describe('findMine', () => {
    it('joins the logo metadata, without loading its bytes', async () => {
      queryBuilder.getOne.mockResolvedValue(
        fakeCompany({
          logo: {
            contentType: 'image/png',
            byteSize: 4096,
            updatedAt: new Date('2026-01-01'),
          } as Company['logo'],
        }),
      );

      const company = await service.findMine(COMPANY_ID);

      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'company.logo',
        'logo',
      );
      expect(company.logo).toMatchObject({ contentType: 'image/png' });
      // `select: false` on CompanyLogo.data is what actually keeps the bytes
      // out — this only pins that the join used here cannot ask for them.
      expect(company.logo).not.toHaveProperty('data');
    });

    it('returns null for logo when the company has none', async () => {
      queryBuilder.getOne.mockResolvedValue(fakeCompany({ logo: null }));

      const company = await service.findMine(COMPANY_ID);

      expect(company.logo).toBeNull();
    });
  });

  describe('update', () => {
    it("refuses to update a company that is not the caller's own", async () => {
      await expect(
        service.update('some-other-id', { name: 'X' }, COMPANY_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(repo.save).not.toHaveBeenCalled();
    });

    it('returns the same shape as findMine, including logo metadata', async () => {
      queryBuilder.getOne.mockResolvedValue(
        fakeCompany({ ice: '001234567000025' }),
      );

      const result = await service.update(
        COMPANY_ID,
        { ice: '001234567000025' },
        COMPANY_ID,
      );

      // update() re-reads through findMine rather than returning the saved
      // entity directly, so a PATCH response carries `logo` the same way a
      // GET does — the plain save() above never loaded that relation.
      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'company.logo',
        'logo',
      );
      expect(result.ice).toBe('001234567000025');
    });

    it('turns a duplicate-name constraint violation into a 409', async () => {
      queryBuilder.getOne.mockResolvedValue(fakeCompany());
      repo.save.mockRejectedValue(
        new QueryFailedError('INSERT', [], { code: '23505' } as never),
      );

      await expect(
        service.update(COMPANY_ID, { name: 'Taken' }, COMPANY_ID),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
