import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsOptional, MaxLength, IsBoolean } from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({
    example: 'John Doe',
    description: 'The name of the customer.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255, { message: 'Name must be at most 255 characters long' })
  name: string;

  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'The email address of the customer.',
  })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255, { message: 'Email must be at most 255 characters long' })
  email: string;

  @ApiProperty({
    example: '+1-555-0123',
    description: 'The phone number of the customer.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50, { message: 'Phone must be at most 50 characters long' })
  phone: string;

  @ApiProperty({
    example: '123 Main St, City',
    description: 'The address of the customer.',
  })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({
    example: true,
    description: 'Whether the customer is active.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
