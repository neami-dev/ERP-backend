import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { StockMovementType } from '../entities/stock-movement.entity';

/**
 * Filters for the stock history screen: what moved, where, and how.
 */
export class StockMovementQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Only movements of this product.',
  })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'Only movements in this warehouse.',
  })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({
    enum: StockMovementType,
    description: 'Only movements of this type.',
  })
  @IsOptional()
  @IsEnum(StockMovementType)
  type?: StockMovementType;
}
