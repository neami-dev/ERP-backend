import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SignUpDto {
  @ApiProperty({
    example: 'ABC Manufacturing',
    description: 'Name of the company to create for this new account',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  companyName: string;

  @ApiProperty({
    example: 'ali@abc.com',
    description: 'Email of the first user of the company',
  })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({
    example: 'secret123',
    description: 'Password, at least 8 characters',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @ApiProperty({ example: 'Ali' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiPropertyOptional({ example: 'Neami' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;
}
