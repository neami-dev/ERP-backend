import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsUUID, Min } from 'class-validator';

export class CreatePurchaseOrderItemDto {
  @ApiProperty({
    example: 'f5b71129-48ef-4993-8684-fe178352c1c9',
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