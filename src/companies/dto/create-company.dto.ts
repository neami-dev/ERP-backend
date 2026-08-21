import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsEmail,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
} from 'class-validator';

export class CreateCompanyDto {
    @ApiProperty({
        example: 'ABC Manufacturing',
        description: 'Company name',
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(150)
    name: string;

    @ApiPropertyOptional({
        example: 'contact@abc.com',
        description: 'Company email',
    })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({
        example: '+212600000000',
        description: 'Company phone number',
    })
    @IsOptional()
    @IsString()
    @MaxLength(30)
    phone?: string;

    @ApiPropertyOptional({
        example: 'Casablanca, Morocco',
        description: 'Company address',
    })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    address?: string;
}