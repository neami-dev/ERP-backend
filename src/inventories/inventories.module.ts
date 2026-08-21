import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Inventory } from './entities/inventory.entity';
import { Product } from 'src/products/entities/product.entity';
import { Warehouse } from 'src/warehouses/entities/warehouse.entity';
import { InventoriesService } from './inventories.service';
import { InventoriesController } from './inventories.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Inventory, Product, Warehouse])],
  controllers: [InventoriesController],
  providers: [InventoriesService],
})
export class InventoriesModule {}
