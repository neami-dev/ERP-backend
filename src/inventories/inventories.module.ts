import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoriesController } from './inventories.controller';
import { InventoriesService } from './inventories.service';
import { Inventory } from './entities/inventory.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Inventory])],
  controllers: [InventoriesController],
  providers: [InventoriesService],
  exports: [InventoriesService],
})
export class InventoriesModule {}
