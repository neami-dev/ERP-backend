import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CreateProductDto {
    @ApiProperty({
        example: 'iPhone 16 Pro',
        description: 'The name of the product.',
    })
    @IsString()
    @IsNotEmpty()
    name: string;

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
    sku: string;
}
