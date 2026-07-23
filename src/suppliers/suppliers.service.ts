import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Supplier } from './entities/supplier.entity';
import { Repository } from 'typeorm';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { Company } from 'src/companies/entities/company.entity';

@Injectable()
export class SuppliersService {
  constructor(@InjectRepository(Supplier) private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(Company) private readonly companyRepo: Repository<Company>
  ) { }

  async create(createSupplierDto: CreateSupplierDto) {
    const existingEmail = await this.supplierRepo.existsBy({
      email: createSupplierDto.email,
    });
    if (existingEmail) {
      throw new ConflictException('Supplier by this email already exists');
    }

    const existingName = await this.supplierRepo.existsBy({
      name: createSupplierDto.name,
    });
    if (existingName) {
      throw new ConflictException('Supplier by this name already exists');
    }

    const company = await this.companyRepo.existsBy({
      id: createSupplierDto.company_id,
    });
    
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const supplier = this.supplierRepo.create(createSupplierDto);
    return this.supplierRepo.save(supplier);
  }

  async findAll(query: PaginationDto) {
    const { page, limit } = query;

    const skip = (page - 1) * limit;
    const [suppliers, total] = await this.supplierRepo.findAndCount({
      skip,
      take: limit,
    });

    return {
      data: suppliers,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const supplier = await this.supplierRepo.findOneBy({ id });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }
    return supplier;
  }

  async update(id: string, updateSupplierDto: UpdateSupplierDto) {
    if (updateSupplierDto?.email) {
      const existingSupplier = await this.supplierRepo.existsBy({
        email: updateSupplierDto.email,
      });
      if (existingSupplier) {
        throw new ConflictException('Supplier already exists');
      }
    }

    const supplier = await this.findOne(id);

    Object.assign(supplier, updateSupplierDto);
    return this.supplierRepo.save(supplier);
  }

  async remove(id: string) {
    const supplier = await this.findOne(id);
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }
    return this.supplierRepo.remove(supplier);
  }
}
