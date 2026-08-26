import { PartialType, PickType } from '@nestjs/swagger';
import { CreateGoodsReceiptDto } from './create-goods-receipt.dto';

// Only the header fields can change after creation, and only while the
// receipt is still a DRAFT — see `GoodsReceiptsService.update`. The lines
// (`items`) and the order they belong to are fixed at creation: editing a
// quantity is a new receipt, not a patch to an old one.
export class UpdateGoodsReceiptDto extends PartialType(
  PickType(CreateGoodsReceiptDto, [
    'warehouseId',
    'receivedAt',
    'notes',
  ] as const),
) {}
