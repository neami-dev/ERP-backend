import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

    // The company is never taken from the request body — it is read from the
    // JWT of the caller, so a user cannot move stock inside another company.

    @ApiProperty({
        enum: StockMovementType,
        example: StockMovementType.IN,
        description: 'The type of stock movement.',
    })
    @IsEnum(StockMovementType)
    type: StockMovementType;

    @ApiProperty({
        example: 25,
        description:
            'The quantity moved. Must be positive for IN, OUT, RESERVE and ' +
            'RELEASE. An ADJUSTMENT may be negative, to correct a count downwards.',
    })
    @IsInt()
    @IsNotEmpty()
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

    @ApiPropertyOptional({
        example: '550e8400-e29b-41d4-a716-446655440002',
        description:
            'The source document ID. Required for every reference type except ' +
            'ADJUSTMENT, which is a manual correction with no source document.',
    })
    @IsOptional()
    @IsUUID()
    referenceId?: string;

    @ApiProperty({
        example: 'Initial stock received.',
        description: 'Additional notes about the movement.',
        required: false,
    })
    @IsOptional()
    @IsString()
    notes?: string;
}