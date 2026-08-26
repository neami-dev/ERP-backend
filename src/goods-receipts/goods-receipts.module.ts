import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GoodsReceiptsController } from './goods-receipts.controller';
import { GoodsReceiptsService } from './goods-receipts.service';
import { GoodsReceiptItemsService } from './goods-receipt-items.service';
import { GoodsReceipt } from './entities/goods-receipt.entity';
import { GoodsReceiptItem } from './entities/goods-receipt-item.entity';
import { PurchaseOrder } from 'src/purchases/entities/purchase-order.entity';
import { PurchaseOrderItem } from 'src/purchases/entities/purchase-order-item.entity';
import { Warehouse } from 'src/warehouses/entities/warehouse.entity';
import { InventoriesModule } from 'src/inventories/inventories.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GoodsReceipt,
      GoodsReceiptItem,
      PurchaseOrder,
      PurchaseOrderItem,
      Warehouse,
    ]),

    // Confirming a receipt raises stock through InventoriesService, so the
    // locking and the movement rules live in one place only.
    InventoriesModule,
  ],

  controllers: [GoodsReceiptsController],

  providers: [GoodsReceiptsService, GoodsReceiptItemsService],
})
export class GoodsReceiptsModule {}
