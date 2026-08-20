import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';

import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { Warehouse } from './entities/warehouse.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';

/**
 * Every method takes the `companyId` of the caller, read from their JWT,
 * so a user can only ever see and touch the warehouses of their own company.
 */
@Injectable()
export class WarehousesService {
  constructor(
    @InjectRepository(Warehouse)
    private readonly warehouseRepo: Repository<Warehouse>,
  ) { }

  async create(createWarehouseDto: CreateWarehouseDto, companyId: string) {
    await this.assertNameIsFree(createWarehouseDto.name, companyId);

    const warehouse = this.warehouseRepo.create({
      ...createWarehouseDto,
      companyId,
    });

    return await this.warehouseRepo.save(warehouse);
  }

  async findAll(query: PaginationDto, companyId: string) {
    const { page, limit } = query;

    const [warehouses, total] = await this.warehouseRepo.findAndCount({
      where: { companyId },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data: warehouses,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, companyId: string) {
    const warehouse = await this.warehouseRepo.findOneBy({ id, companyId });

    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }

    return warehouse;
  }

  async update(
    id: string,
    updateWarehouseDto: UpdateWarehouseDto,
    companyId: string,
  ) {
    const warehouse = await this.findOne(id, companyId);

    if (updateWarehouseDto.name) {
      await this.assertNameIsFree(updateWarehouseDto.name, companyId, id);
    }

    Object.assign(warehouse, updateWarehouseDto);

    return await this.warehouseRepo.save(warehouse);
  }

  async remove(id: string, companyId: string) {
    const warehouse = await this.findOne(id, companyId);

    // TypeORM's remove() strips the primary key off the returned
    // entity, so the id is put back for the client.
    const removed = await this.warehouseRepo.remove(warehouse);

    return { ...removed, id };
  }

  /**
   * @param ignoreId Warehouse being updated, so it does not clash with itself.
   */
  private async assertNameIsFree(
    name: string,
    companyId: string,
    ignoreId?: string,
  ) {
    const taken = await this.warehouseRepo.existsBy({
      name,
      companyId,
      ...(ignoreId && { id: Not(ignoreId) }),
    });

    if (taken) {
      throw new ConflictException('Warehouse already exists');
    }
  }
}
