import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Warehouse } from './entities/warehouse.entity';
import { Repository } from 'typeorm';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@Injectable()
export class WarehousesService {
  constructor(@InjectRepository(Warehouse) private readonly warehouseRepo: Repository<Warehouse>) { }
  async create(createWarehouseDto: CreateWarehouseDto) {
    const existingWarehouse = await this.warehouseRepo.existsBy(
      { name: createWarehouseDto.name }
    );
    if (existingWarehouse) {
      throw new ConflictException('Warehouse already exists');
    }

    const warehouse = this.warehouseRepo.create({
      name: createWarehouseDto.name,
      address: createWarehouseDto.address,
    });
    return this.warehouseRepo.save(warehouse);
  }

  async findAll(query: PaginationDto) {
    const { page, limit } = query;

    const skip = (page - 1) * limit;
    const [warehouses, total] = await this.warehouseRepo.findAndCount({
      skip,
      take: limit,
    });

    return {
      data: warehouses,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async findOne(id: string) {
    const warehouse = await this.warehouseRepo.findOneBy({ id });
    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }
    return warehouse;
  }

  async update(id: string, updateWarehouseDto: UpdateWarehouseDto) {

    if (updateWarehouseDto?.name) {
      const existingWarehouse = await this.warehouseRepo.existsBy(
        { name: updateWarehouseDto.name }
      );
      if (existingWarehouse) {
        throw new ConflictException('Warehouse already exists');
      }
    }

    const warehouse = await this.findOne(id);

    Object.assign(warehouse, updateWarehouseDto);
    return this.warehouseRepo.save(warehouse);
  }

  async remove(id: string) {
    const warehouse = await this.findOne(id);
    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }
    return this.warehouseRepo.remove(warehouse);
  }
}