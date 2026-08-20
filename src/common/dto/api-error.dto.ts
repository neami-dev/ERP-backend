import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * The shape every error of this API has, produced by
 * [HttpExceptionFilter](../filters/http-exception.filter.ts).
 */
export class ApiErrorDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({ example: 'Bad Request' })
  error: string;

  @ApiProperty({
    example: 'Validation failed: 2 problems',
    description: 'Always a single string, safe to show to a user.',
  })
  message: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['name should not be empty', 'sku must be a string'],
    description:
      'Per-field validation messages. Present only on a validation error.',
  })
  details?: string[];

  @ApiProperty({ example: '/products' })
  path: string;

  @ApiProperty({ example: '2026-08-20T13:05:41.559Z' })
  timestamp: string;
}
