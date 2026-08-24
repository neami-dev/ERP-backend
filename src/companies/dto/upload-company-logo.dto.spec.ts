import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
  UploadCompanyLogoDto,
  MAX_LOGO_BYTES,
  MAX_LOGO_BASE64_LENGTH,
} from './upload-company-logo.dto';

/**
 * `MAX_LOGO_BASE64_LENGTH` exists so a maximum-size upload is rejected here,
 * cleanly, before the request reaches the service. These pin the boundary
 * exactly at `MAX_LOGO_BYTES`, since base64's 4-characters-per-3-bytes
 * padding makes it easy to compute this one byte off in either direction —
 * it happened once already while writing this file.
 */
describe('UploadCompanyLogoDto validation', () => {
  async function errorsFor(data: string) {
    const dto = plainToInstance(UploadCompanyLogoDto, {
      contentType: 'image/png',
      data,
    });

    return await validate(dto);
  }

  it('accepts a payload that decodes to exactly the byte limit', async () => {
    const base64 = Buffer.alloc(MAX_LOGO_BYTES).toString('base64');

    expect(base64).toHaveLength(MAX_LOGO_BASE64_LENGTH);
    expect(await errorsFor(base64)).toHaveLength(0);
  });

  it('rejects a payload clearly over the limit', async () => {
    // +3 bytes guarantees a full extra group of 4 base64 characters — +1 or
    // +2 can land on a padding boundary where the string length does not
    // change at all (true for 524288, this limit's own byte count), which
    // is exactly why the service re-checks the *decoded* length rather than
    // trusting this DTO check alone. See company-logos.service.spec.ts.
    const base64 = Buffer.alloc(MAX_LOGO_BYTES + 3).toString('base64');

    expect(await errorsFor(base64)).not.toHaveLength(0);
  });

  it('can pass this check while still being one byte over the limit', async () => {
    // The padding quirk made concrete: this string's length is identical to
    // the exactly-at-the-limit case above, yet it decodes to one byte too
    // many. A DTO length check alone would let it through.
    const base64 = Buffer.alloc(MAX_LOGO_BYTES + 1).toString('base64');

    expect(base64).toHaveLength(MAX_LOGO_BASE64_LENGTH);
    expect(await errorsFor(base64)).toHaveLength(0);
    expect(Buffer.from(base64, 'base64').byteLength).toBe(MAX_LOGO_BYTES + 1);
  });

  it('rejects a claimed content type outside the allowlist', async () => {
    const dto = plainToInstance(UploadCompanyLogoDto, {
      contentType: 'image/svg+xml',
      data: Buffer.from('irrelevant').toString('base64'),
    });

    expect(await validate(dto)).not.toHaveLength(0);
  });
});
