import { Module } from '@nestjs/common';
import { PurchasesController } from './purchases.controller';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PurchaseOrder } from './entities/purchase-order.entity';
import { Supplier } from 'src/suppliers/entities/supplier.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';

import { PurchaseOrdersService } from './services/purchase-orders.service';
import { PurchaseOrderItemsService } from './services/purchase-order-items.service';
import { DocumentNumberModule } from 'src/common/ document-number/document-number.module';



@Module({
  imports: [
    TypeOrmModule.forFeature([
      PurchaseOrder,
      Supplier,
      PurchaseOrderItem,
    ]),

    DocumentNumberModule,
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