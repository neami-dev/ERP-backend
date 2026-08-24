import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CompanyLogosService } from './company-logos.service';
import { CompaniesController } from './companies.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from './entities/company.entity';
import { CompanyLogo } from './entities/company-logo.entity';
import { DocumentNumberModule } from 'src/common/ document-number/document-number.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Company, CompanyLogo]),
    DocumentNumberModule,
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService, CompanyLogosService],
  // Signup creates a company, so AuthModule needs this service. Nothing
  // outside this module has a reason to touch a logo directly.
  exports: [CompaniesService],
})
export class CompaniesModule { }
