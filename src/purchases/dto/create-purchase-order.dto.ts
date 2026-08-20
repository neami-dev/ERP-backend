import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreatePurchaseOrderDto {
  @ApiProperty({
    example: 'f5b71129-48ef-4993-8684-fe178352c1c9',
    description: 'The ID of the supplier.',
  })
  @IsUUID()
  @IsNotEmpty()
  supplierId: string;


  // The company is never taken from the request body — it is read from the
  // JWT of the caller, so a user cannot create an order inside another company.

  @ApiPropertyOptional({
    example: '2026-01-25',
    format: 'date',
    description:
      'The expected delivery date, as a calendar date `YYYY-MM-DD`. ' +
      'Not a timestamp — a delivery date has no time of day.',
  })
  @IsOptional()
  @IsDateString({ strict: true, strictSeparator: true })
  expectedDate?: string;

  @ApiProperty({
    example: 'Order for Q1 inventory',
    description: 'Additional notes for the order.',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
