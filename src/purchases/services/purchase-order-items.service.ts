import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchaseOrderItem } from '../entities/purchase-order-item.entity';

@Injectable()
export class PurchaseOrderItemsService {
  constructor(
    @InjectRepository(PurchaseOrderItem)
    private readonly purchaseOrderItemRepository: Repository<PurchaseOrderItem>,
  ) {}

  findAll() {
    return this.purchaseOrderItemRepository.find({
      relations: ['purchaseOrder'],
    });
  }

  findOne(id: number) {
    return this.purchaseOrderItemRepository.findOne({
      where: { id },
      relations: ['purchaseOrder'],
    });
  }

  async remove(id: number) {
    const item = await this.findOne(id);

    if (!item) {
      throw new NotFoundException('Purchase order item not found');
    }

    await this.purchaseOrderItemRepository.remove(item);
  }
}