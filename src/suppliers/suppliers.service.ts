import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';

import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { Supplier } from './entities/supplier.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';

/**
 * Every method takes the `companyId` of the caller, read from their JWT.
 * It is used both to scope reads and to stamp writes, so a user can never
 * see or touch a supplier belonging to another company.
 */
@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
  ) { }

  async create(createSupplierDto: CreateSupplierDto, companyId: string) {
    await this.assertNoConflict(createSupplierDto, companyId);

    const supplier = this.supplierRepo.create({
      ...createSupplierDto,
      companyId,
    });

    return await this.supplierRepo.save(supplier);
  }

  async findAll(query: PaginationDto, companyId: string) {
    const { page, limit } = query;

    const [suppliers, total] = await this.supplierRepo.findAndCount({
      where: { companyId },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
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

  async findOne(id: string, companyId: string) {
    const supplier = await this.supplierRepo.findOneBy({ id, companyId });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    return supplier;
  }

  async update(
    id: string,
    updateSupplierDto: UpdateSupplierDto,
    companyId: string,
  ) {
    const supplier = await this.findOne(id, companyId);

    await this.assertNoConflict(updateSupplierDto, companyId, id);

    Object.assign(supplier, updateSupplierDto);

    return await this.supplierRepo.save(supplier);
  }

  async remove(id: string, companyId: string) {
    const supplier = await this.findOne(id, companyId);

    return await this.supplierRepo.remove(supplier);
  }

  /**
   * Name and email are unique per company, not globally — two companies may
   * both work with the same supplier.
   *
   * @param ignoreId Supplier being updated, so it does not conflict with itself.
   */
  private async assertNoConflict(
    dto: Partial<Pick<CreateSupplierDto, 'name' | 'email'>>,
    companyId: string,
    ignoreId?: string,
  ) {
    const idFilter = ignoreId ? Not(ignoreId) : undefined;

    if (dto.email) {
      const emailTaken = await this.supplierRepo.existsBy({
        email: dto.email,
        companyId,
        ...(idFilter && { id: idFilter }),
      });

      if (emailTaken) {
        throw new ConflictException('Supplier by this email already exists');
      }
    }

    if (dto.name) {
      const nameTaken = await this.supplierRepo.existsBy({
        name: dto.name,
        companyId,
        ...(idFilter && { id: idFilter }),
      });

      if (nameTaken) {
        throw new ConflictException('Supplier by this name already exists');
      }
    }
  }
}
