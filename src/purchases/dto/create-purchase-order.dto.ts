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


  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'The ID of the company.',
  })
  @IsUUID()
  @IsNotEmpty()
  companyId: string;

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
