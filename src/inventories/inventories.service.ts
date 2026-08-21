import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inventory } from './entities/inventory.entity';
import { Product } from 'src/products/entities/product.entity';
import { Warehouse } from 'src/warehouses/entities/warehouse.entity';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@Injectable()
export class InventoriesService {
  constructor(
    @InjectRepository(Inventory)
    private readonly inventoryRepo: Repository<Inventory>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepo: Repository<Warehouse>,
  ) { }

  async create(createInventoryDto: CreateInventoryDto) {
    const { productId, warehouseId } = createInventoryDto;
    const product = await this.productRepo.findOneBy({
      id: productId,
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const warehouse = await this.warehouseRepo.findOneBy({
      id: warehouseId,
    });
    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }

    const existingInventory = await this.inventoryRepo.exists({
      where: {
        product: { id: productId },
        warehouse: { id: warehouseId },
      },
    });

    if (existingInventory) {
      throw new ConflictException(
        'Inventory already exists for this product and warehouse',
      );
    }

    const inventory = this.inventoryRepo.create({
      product,
      warehouse,
      quantityOnHand: createInventoryDto.quantityOnHand ?? 0,
      quantityReserved: createInventoryDto.quantityReserved ?? 0,
    });

    return this.inventoryRepo.save(inventory);
  }

  async findAll(query: PaginationDto) {
    const { page, limit } = query;

    const skip = (page - 1) * limit;

    const [inventories, total] = await this.inventoryRepo.findAndCount({
      skip,
      take: limit,
    });

    return {
      data: inventories,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const inventory = await this.inventoryRepo.findOneBy({ id });
    if (!inventory) {
      throw new NotFoundException('Inventory not found');
    }
    return inventory;
  }

  async update(id: string, updateInventoryDto: UpdateInventoryDto) {
    const inventory = await this.findOne(id);

    if (updateInventoryDto.productId) {
      const product = await this.productRepo.findOneBy({
        id: updateInventoryDto.productId,
      });
      if (!product) {
        throw new NotFoundException('Product not found');
      }
      inventory.product = product;
    }

    if (updateInventoryDto.warehouseId) {
      const warehouse = await this.warehouseRepo.findOneBy({
        id: updateInventoryDto.warehouseId,
      });
      if (!warehouse) {
        throw new NotFoundException('Warehouse not found');
      }
      inventory.warehouse = warehouse;
    }

    if (updateInventoryDto.quantityOnHand !== undefined) {
      inventory.quantityOnHand = updateInventoryDto.quantityOnHand;
    }

    if (updateInventoryDto.quantityReserved !== undefined) {
      inventory.quantityReserved = updateInventoryDto.quantityReserved;
    }

    return this.inventoryRepo.save(inventory);
  }

  async remove(id: string) {
    const inventory = await this.findOne(id);
    return this.inventoryRepo.remove(inventory);
  }
}
