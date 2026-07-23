import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateSupplierDto {
  @ApiProperty({
    example: 'Acme Supplies',
    description: 'The name of the supplier.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255, { message: 'Name must be at most 255 characters long' })
  name: string;

  @ApiProperty({
    example: 'contact@acme.com',
    description: 'The email address of the supplier.',
  })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255, { message: 'Email must be at most 255 characters long' })
  email: string;

  @ApiProperty({
    example: '+1-555-0123',
    description: 'The phone number of the supplier.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50, { message: 'Phone must be at most 50 characters long' })
  phone: string;

  @ApiProperty({
    example: '123 Industrial Way, City',
    description: 'The address of the supplier.',
  })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({
    example: true,
    description: 'Whether the supplier is active.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'The ID of the company associated with the supplier.',
  })
  @IsUUID()
  @IsNotEmpty()
  company_id: string;
}
