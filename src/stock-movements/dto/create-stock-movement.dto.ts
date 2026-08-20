import { ApiProperty } from '@nestjs/swagger';
import {
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Min,
} from 'class-validator';
import { StockMovementReferenceType, StockMovementType } from '../entities/stock-movement.entity';

export class CreateStockMovementDto {
    @ApiProperty({
        example: '550e8400-e29b-41d4-a716-446655440000',
        description: 'The ID of the product.',
    })
    @IsUUID()
    @IsNotEmpty()
    productId: string;

    @ApiProperty({
        example: '550e8400-e29b-41d4-a716-446655440001',
        description: 'The ID of the warehouse.',
    })
    @IsUUID()
    @IsNotEmpty()
    warehouseId: string;

    @ApiProperty({
        example: '550e8400-e29b-41d4-a716-446655440003',
        description: 'The ID of the company.',
    })
    @IsUUID()
    @IsNotEmpty()
   companyId: string;

    @ApiProperty({
        enum: StockMovementType,
        example: StockMovementType.IN,
        description: 'The type of stock movement.',
    })
    @IsEnum(StockMovementType)
    type: StockMovementType;

    @ApiProperty({
        example: 25,
        description: 'The quantity moved.',
        minimum: 1,
    })
    @IsInt()
    @Min(1)
    quantity: number;

    @ApiProperty({
        example: 15.50,
        description: 'Unit cost for this movement (for IN movements, required).',
        required: false,
    })
    @IsOptional()
    @IsNumber()
    unitCost?: number;

    @ApiProperty({
        enum: StockMovementReferenceType,
        example: StockMovementReferenceType.PURCHASE_ORDER,
        description: 'The source document type.',
    })
    @IsEnum(StockMovementReferenceType)
    referenceType: StockMovementReferenceType;

    @ApiProperty({
        example: '550e8400-e29b-41d4-a716-446655440002',
        description: 'The source document ID.',
    })
    @IsUUID()
    @IsNotEmpty()
    referenceId: string;

    @ApiProperty({
        example: 'Initial stock received.',
        description: 'Additional notes about the movement.',
        required: false,
    })
    @IsOptional()
    @IsString()
    notes?: string;
}