import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class ReceivePurchaseOrderDto {
  @ApiProperty({
    example: 'f5b71129-48ef-4993-8684-fe178352c1c9',
    description: 'The ID of the warehouse receiving the stock.',
  })
  @IsUUID()
  @IsNotEmpty()
  warehouseId: string;
}
