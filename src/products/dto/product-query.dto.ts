import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import { PaginationDto } from "src/common/dto/pagination.dto";

export class ProductQueryDto extends PaginationDto {

    // @ApiPropertyOptional({
    //     example: 'iPhone',
    //     description: 'Search term for product name or description.',
    // })
    // @IsOptional()
    // @IsString()
    // search?: string;

    // @ApiPropertyOptional({
    //     example: 'Electronics',
    //     description: 'Filter products by category.',
    // })
    // @IsOptional()
    // @IsString()
    // category?: string;

    // @ApiPropertyOptional({
    //     example: 'price',
    //     description: 'Sort products by a specific field (price, name, createdAt).',
    //     enum: ['price', 'name', 'createdAt'],
    // })
    // @IsOptional()
    // @IsIn(['price', 'name', 'createdAt'])
    // sort: 'price' | 'name' | 'createdAt' = 'createdAt';
}