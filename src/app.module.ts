import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DatabaseConfig } from './config/database.config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { AppService } from './app.service';
import { AppController } from './app.controller';
import { WarehousesModule } from './warehouses/warehouses.module';
import { CategoriesModule } from './categories/categories.module';
import { InventoriesModule } from './inventories/inventories.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { PurchaseOrdersModule } from './purchases/purchases.module';
import { CompaniesModule } from './companies/companies.module';

@Module({
  controllers: [AppController],
  providers: [AppService],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync(DatabaseConfig),

    AuthModule,

    UsersModule,

    ProductsModule,

    CategoriesModule,

    WarehousesModule,

    InventoriesModule,

    SuppliersModule,

    PurchaseOrdersModule,

    CompaniesModule,
  ],
})
export class AppModule { }