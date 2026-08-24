import { ApiProperty } from '@nestjs/swagger';
import {
  IsBase64,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

/** The claimed content type — checked against the file's own bytes on upload. */
export const ALLOWED_LOGO_CONTENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

/**
 * Largest logo accepted, in decoded bytes. Generous for a logo — a 512×512
 * PNG is typically well under 100 KB.
 */
export const MAX_LOGO_BYTES = 512 * 1024;

/**
 * Largest base64 *string* accepted, checked here as the boundary a user
 * actually hits — a clean 400 with a size in the message, before the request
 * reaches the service.
 *
 * Base64 pads to a multiple of 4 output characters per 3 input bytes, so the
 * exact length of a `MAX_LOGO_BYTES`-sized payload is `4 * ceil(bytes / 3)` —
 * rounding the two operations in the other order undercounts padding and
 * would reject a legitimately maximum-size upload right at the boundary.
 *
 * This is an upper bound, not the authority. Line breaks or missing padding
 * shift the ratio, and base64's own 4-characters-per-3-bytes grouping means a
 * payload one or two bytes over `MAX_LOGO_BYTES` can encode to an *identical*
 * string length — this check would wave it through. The service re-checks
 * the *decoded* byte length and is the one that actually enforces
 * `MAX_LOGO_BYTES`; see `upload-company-logo.dto.spec.ts` for the exact case.
 */
export const MAX_LOGO_BASE64_LENGTH = 4 * Math.ceil(MAX_LOGO_BYTES / 3);

export class UploadCompanyLogoDto {
  @ApiProperty({
    enum: ALLOWED_LOGO_CONTENT_TYPES,
    example: 'image/png',
    description:
      'What the client claims the file is. The upload is rejected if the ' +
      "bytes don't actually match — see detectImageType.",
  })
  @IsIn(ALLOWED_LOGO_CONTENT_TYPES)
  contentType: (typeof ALLOWED_LOGO_CONTENT_TYPES)[number];

  @ApiProperty({
    example: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB...',
    description:
      'The image, base64-encoded, no `data:` prefix. At most 512 KB decoded.',
  })
  @IsString()
  @IsNotEmpty()
  @IsBase64()
  @MaxLength(MAX_LOGO_BASE64_LENGTH, {
    message: 'Logo must be at most 512 KB.',
  })
  data: string;
}
