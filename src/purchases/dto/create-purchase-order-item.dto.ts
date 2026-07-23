import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsUUID, Min } from 'class-validator';

export class CreatePurchaseOrderItemDto {
  @ApiProperty({
    example: 1,
    description: 'Product ID',
  })
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    example: 10,
    description: 'Quantity of the product',
  })
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  quantity: number;

  @ApiProperty({
    example: 25.50,
    description: 'Unit cost of the product',
  })
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  unitCost: number; 
}