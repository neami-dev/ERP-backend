import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateWarehouseDto {
  @ApiProperty({
    example: 'Main Warehouse',
    description: 'The name of the warehouse.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255, { message: 'Name must be at most 255 characters long' })
  name: string;

  @ApiProperty({
    example: '123 Industrial Way, City',
    description: 'The address of the warehouse.',
  })
  @IsString()
  @IsNotEmpty()
  address: string;
}