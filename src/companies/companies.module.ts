import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from './entities/company.entity';
import { Supplier } from 'src/suppliers/entities/supplier.entity';
import { DocumentNumberModule } from 'src/common/ document-number/document-number.module';

@Module({
  imports: [TypeOrmModule.forFeature([Company,Supplier]),DocumentNumberModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
})
export class CompaniesModule { }
