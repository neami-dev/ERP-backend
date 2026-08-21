import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from './entities/company.entity';
import { DocumentNumberModule } from 'src/common/ document-number/document-number.module';

@Module({
  imports: [TypeOrmModule.forFeature([Company]), DocumentNumberModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  // Signup creates a company, so AuthModule needs this service.
  exports: [CompaniesService],
})
export class CompaniesModule { }
