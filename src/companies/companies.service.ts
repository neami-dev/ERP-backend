import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Company } from './entities/company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { DocumentNumberService } from 'src/common/ document-number/document-number.service';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly documentNumberService: DocumentNumberService,
    private readonly dataSource: DataSource,
  ) { }

  async create(createCompanyDto: CreateCompanyDto) { 
    const existingCompany = await this.companyRepository.findOneBy({
      name: createCompanyDto.name,
    });

    if (existingCompany) {
      throw new ConflictException('Company with this name already exists');
    }

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const company = queryRunner.manager.create(Company, createCompanyDto);
      await queryRunner.manager.save(company);
      console.log({company});
      
      
      await this.documentNumberService.createDefaultSequences(
        company.id,
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();

      return company;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll() {
    return await this.companyRepository.find();
  }

  async findOne(id: string) {
    const company = await this.companyRepository.findOneBy({ id });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  async update(id: string, updateCompanyDto: UpdateCompanyDto) {
    const company = await this.companyRepository.findOneBy({ id });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    if (updateCompanyDto.name) {
      const conflict = await this.companyRepository.findOneBy({
        name: updateCompanyDto.name,
      });

      if (conflict && conflict.id !== id) {
        throw new ConflictException(
          'Company with this name already exists',
        );
      }
    }

    await this.companyRepository.update(id, updateCompanyDto);

    return await this.companyRepository.findOneBy({ id });
  }

  async remove(id: string) {
    const company = await this.companyRepository.findOneBy({ id });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    await this.companyRepository.delete(id);

    return company;
  }
}