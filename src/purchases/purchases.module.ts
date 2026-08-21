import { Module } from '@nestjs/common';
import { PurchasesController } from './purchases.controller';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PurchaseOrder } from './entities/purchase-order.entity';
import { Supplier } from 'src/suppliers/entities/supplier.entity';
import { Warehouse } from 'src/warehouses/entities/warehouse.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';

import { PurchaseOrdersService } from './services/purchase-orders.service';
import { PurchaseOrderItemsService } from './services/purchase-order-items.service';
import { DocumentNumberModule } from 'src/common/ document-number/document-number.module';
import { ProductsModule } from 'src/products/products.module';
import { InventoriesModule } from 'src/inventories/inventories.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PurchaseOrder,
      Supplier,
      Warehouse,
      PurchaseOrderItem,
    ]),

    DocumentNumberModule,
    ProductsModule,
    // Receiving an order raises stock through InventoriesService, so the
    // locking and the movement rules live in one place only.
    InventoriesModule,
  ],

  controllers: [
    PurchasesController,
  ],

  providers: [
    PurchaseOrdersService,
    PurchaseOrderItemsService,
  ],
})
export class PurchaseOrdersModule { }
