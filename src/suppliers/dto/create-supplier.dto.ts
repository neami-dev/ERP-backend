import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

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

  // The company is never taken from the request body — it is read from the
  // JWT of the caller, so a user cannot create data inside another company.
}
