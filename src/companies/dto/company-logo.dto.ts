import { ApiProperty } from '@nestjs/swagger';

/**
 * What a company's logo looks like in a JSON response: never the bytes
 * themselves, which live behind `GET /companies/me/logo`.
 */
export class CompanyLogoDto {
  @ApiProperty({ example: 'image/png' })
  contentType: string;

  @ApiProperty({ example: 48231, description: 'Decoded size, in bytes.' })
  byteSize: number;

  @ApiProperty()
  updatedAt: Date;
}
