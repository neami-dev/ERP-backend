import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateGoodsReceiptItemDto {
  @ApiProperty({
    example: 'f5b71129-48ef-4993-8684-fe178352c1c9',
    description:
      'The ID of the purchase order line this quantity was received against.',
  })
  @IsUUID()
  @IsNotEmpty()
  purchaseOrderItemId: string;

  @ApiProperty({
    example: 5,
    description: 'Quantity received for this line.',
  })
  @IsInt()
  @Min(1)
  quantityReceived: number;
}

export class CreateGoodsReceiptDto {
  @ApiProperty({
    example: 'f5b71129-48ef-4993-8684-fe178352c1c9',
    description: 'The ID of the purchase order being received.',
  })
  @IsUUID()
  @IsNotEmpty()
  purchaseOrderId: string;

  @ApiProperty({
    example: 'f5b71129-48ef-4993-8684-fe178352c1c9',
    description: 'The ID of the warehouse receiving the stock.',
  })
  @IsUUID()
  @IsNotEmpty()
  warehouseId: string;

  // The company is never taken from the request body — it is read from the
  // JWT of the caller, so a user cannot receive stock into another company.

  @ApiPropertyOptional({
    example: '2026-01-25T10:00:00.000Z',
    description: 'When the goods arrived. Defaults to now.',
  })
  @IsOptional()
  @IsDateString()
  receivedAt?: string;

  @ApiPropertyOptional({
    example: 'Two boxes arrived damaged',
    description: 'Additional notes for the receipt.',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    type: [CreateGoodsReceiptItemDto],
    description:
      'The purchase order lines being received, with the quantity received for each.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateGoodsReceiptItemDto)
  items: CreateGoodsReceiptItemDto[];
}
