import { PickType } from '@nestjs/swagger';
import { CreateGoodsReceiptItemDto } from './create-goods-receipt.dto';

// Only the quantity can change. `purchaseOrderItemId` (and the `productId`
// it implies) is fixed at creation, same as `productId` on
// UpdatePurchaseOrderItemDto — changing which line this is against is a new
// line, not an edit to the old one.
export class UpdateGoodsReceiptItemDto extends PickType(
  CreateGoodsReceiptItemDto,
  ['quantityReceived'] as const,
) {}
