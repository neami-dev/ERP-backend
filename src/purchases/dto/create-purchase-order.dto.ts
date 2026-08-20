import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
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

  @ApiProperty({
    example: '2024-01-25',
    description: 'The expected delivery date.',
    required: false,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expectedDate?: Date;

  @ApiProperty({
    example: 'Order for Q1 inventory',
    description: 'Additional notes for the order.',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
