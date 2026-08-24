import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UpdateCompanyDto } from './update-company.dto';

/**
 * Exercises the real transform-then-validate pipeline the global
 * `ValidationPipe` runs, for the fields where the exact rule matters:
 * ICE is the one legal identifier with a confirmed fixed format, currency
 * is restricted to what `roundMoney()` can represent correctly, and the
 * fiscal month is the field most likely to be sent as 0 or 13 by a UI that
 * treats it as an array index or thinks in "13th month" bonus-pay terms.
 */
describe('UpdateCompanyDto validation', () => {
  async function errorsFor(payload: Record<string, unknown>) {
    const dto = plainToInstance(UpdateCompanyDto, payload);

    return await validate(dto);
  }

  describe('ice', () => {
    it('accepts exactly 15 digits', async () => {
      expect(await errorsFor({ ice: '001234567000025' })).toHaveLength(0);
    });

    it('rejects 14 digits', async () => {
      expect(await errorsFor({ ice: '00123456700002' })).not.toHaveLength(0);
    });

    it('rejects 16 digits', async () => {
      expect(await errorsFor({ ice: '0012345670000255' })).not.toHaveLength(0);
    });

    it('accepts spaced digits, by trimming and compacting first', async () => {
      expect(await errorsFor({ ice: '001 234 567 000 025' })).toHaveLength(0);
    });

    it('treats an empty string as clearing the field, not a format error', async () => {
      expect(await errorsFor({ ice: '' })).toHaveLength(0);
    });

    it('rejects non-digit characters', async () => {
      expect(await errorsFor({ ice: '00123456700002X' })).not.toHaveLength(0);
    });
  });

  describe('defaultCurrency', () => {
    it('accepts a supported two-decimal currency', async () => {
      expect(await errorsFor({ defaultCurrency: 'MAD' })).toHaveLength(0);
    });

    it('accepts lowercase input, by uppercasing before the check', async () => {
      expect(await errorsFor({ defaultCurrency: 'mad' })).toHaveLength(0);
    });

    it('rejects a three-decimal currency, even though it is real ISO 4217', async () => {
      // TND has 3 decimal places; roundMoney() and every money column assume 2.
      expect(await errorsFor({ defaultCurrency: 'TND' })).not.toHaveLength(0);
    });

    it('rejects a currency not on the allowlist', async () => {
      expect(await errorsFor({ defaultCurrency: 'XYZ' })).not.toHaveLength(0);
    });
  });

  describe('fiscalYearStartMonth', () => {
    it.each([1, 6, 12])('accepts month %d', async (month) => {
      expect(await errorsFor({ fiscalYearStartMonth: month })).toHaveLength(0);
    });

    it('rejects month 0', async () => {
      expect(await errorsFor({ fiscalYearStartMonth: 0 })).not.toHaveLength(0);
    });

    it('rejects month 13', async () => {
      expect(await errorsFor({ fiscalYearStartMonth: 13 })).not.toHaveLength(0);
    });
  });

  describe('rcNumber and rcCity', () => {
    it('accepts a number with a slash-separated year', async () => {
      expect(await errorsFor({ rcNumber: '123456/2019' })).toHaveLength(0);
    });

    it('accepts the issuing city as free text', async () => {
      expect(await errorsFor({ rcCity: 'Casablanca' })).toHaveLength(0);
    });
  });

  it('leaves every field optional — an empty update is valid', async () => {
    expect(await errorsFor({})).toHaveLength(0);
  });
});
