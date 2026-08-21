import { OmitType, PartialType } from '@nestjs/swagger';
import { CreatePurchaseOrderItemDto } from './create-purchase-order-item.dto';

export class UpdatePurchaseOrderItemDto extends PartialType(
    OmitType(CreatePurchaseOrderItemDto, [
        'productId',
    ] as const),
) { }