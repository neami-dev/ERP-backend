import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateCategoryDto {
    @ApiProperty({
        example: 'Electronics',
        description: 'The name of the category.',
    })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({
        example: 'Devices and gadgets',
        description: 'A brief description of the category.',
    })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({
        example: '123e4567-e89b-12d3-a456-426614174000',
        description: 'The ID of the parent category, if applicable.',
    })
    @IsUUID ()
    @IsOptional()
    parentId?: string | null;

}
