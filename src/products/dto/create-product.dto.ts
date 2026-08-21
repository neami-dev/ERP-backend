import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";

export class CreateProductDto {
    @ApiProperty({
        example: 'iPhone 16 Pro',
        description: 'The name of the product.',
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(255, { message: 'Name must be at most 255 characters long' })
    name: string;

    @ApiProperty({
        example: 999.99,
        description: 'The selling price of the product.',
    })
    @Type(() => Number)
    @IsNotEmpty()
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    sellingPrice: number;

    @ApiProperty({
        example: 799.99,
        description: 'The purchase price of the product.',
    })
    @Type(() => Number)
    @IsNotEmpty()
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    purchasePrice: number;

    @ApiPropertyOptional({
        example: 'The latest iPhone model with advanced features.',
        description: 'A brief description of the product.',
    })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({
        example: 'SKU12345',
        description: 'The stock keeping unit (SKU) of the product.',
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(50, { message: 'SKU must be at most 50 characters long' })
    sku: string;

    @ApiPropertyOptional({
        example: '123e4567-e89b-12d3-a456-426614174000',
        description: 'The category this product belongs to, if any.',
    })
    @IsOptional()
    @IsUUID()
    categoryId?: string | null;
}
