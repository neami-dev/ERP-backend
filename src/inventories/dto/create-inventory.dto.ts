import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateInventoryDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'The ID of the product.',
  })
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    example: '660e8400-e29b-41d4-a716-446655440000',
    description: 'The ID of the warehouse.',
  })
  @IsUUID()
  @IsNotEmpty()
  warehouseId: string;

  @ApiProperty({
    example: 0,
    description: 'The quantity currently on hand.',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantityOnHand?: number;

  @ApiProperty({
    example: 0,
    description: 'The quantity currently reserved.',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantityReserved?: number;
}
