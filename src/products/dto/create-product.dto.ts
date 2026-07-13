import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

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
    @IsNotEmpty()
    sellingPrice: number;

    @ApiProperty({
        example: 799.99,
        description: 'The purchase price of the product.',
    })
    @IsNotEmpty()
    purchasePrice: number;

    @ApiProperty({
        example: 'The latest iPhone model with advanced features.',
        description: 'A brief description of the product.',
    })
    @IsString()
    @IsNotEmpty()
    description: string;

    @ApiProperty({
        example: 'SKU12345',
        description: 'The stock keeping unit (SKU) of the product.',
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(50, { message: 'SKU must be at most 50 characters long' })
    sku: string;
}
