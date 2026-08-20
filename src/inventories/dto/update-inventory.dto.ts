import { PartialType, PickType } from '@nestjs/swagger';
import { CreateInventoryDto } from './create-inventory.dto';

/**
 * Only the counted quantities can be corrected.
 *
 * `productId` and `warehouseId` are deliberately left out: changing them would
 * move stock to a different product or a different warehouse with no trace,
 * and could collide with the existing row for that pair. Delete the row and
 * create the right one instead.
 */
export class UpdateInventoryDto extends PartialType(
  PickType(CreateInventoryDto, ['quantityOnHand', 'quantityReserved'] as const),
) { }
