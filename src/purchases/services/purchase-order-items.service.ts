import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchaseOrderItem } from '../entities/purchase-order-item.entity';
import { CreatePurchaseOrderItemDto } from '../dto/create-purchase-order-item.dto';
import { ProductsService } from 'src/products/products.service';
import { PurchaseOrdersService } from './purchase-orders.service';
import { UpdatePurchaseOrderItemDto } from '../dto/update-purchase-order-item.dto';

/**
 * Items can only be touched while their purchase order is still a DRAFT.
 * `ensureIsDraft` also scopes the order to the caller's company, so an item
 * can never be added to somebody else's order.
 */
@Injectable()
export class PurchaseOrderItemsService {
  constructor(
    @InjectRepository(PurchaseOrderItem)
    private readonly purchaseOrderItemRepository: Repository<PurchaseOrderItem>,
    private readonly productsService: ProductsService,
    private readonly purchaseOrdersService: PurchaseOrdersService,
  ) { }

  async create(
    purchaseOrderId: string,
    createPurchaseOrderItemDto: CreatePurchaseOrderItemDto,
    companyId: string,
  ) {
    const { productId } = createPurchaseOrderItemDto;

    // Ensure the order exists, belongs to this company, and can still change
    await this.purchaseOrdersService.ensureIsDraft(purchaseOrderId, companyId);

    // Scoped to the caller's company, so an order cannot reference a product
    // belonging to someone else.
    await this.productsService.findAvailableProduct(productId, companyId);

    const item = this.purchaseOrderItemRepository.create({
      ...createPurchaseOrderItemDto,
      purchaseOrderId,
    });

    return await this.purchaseOrderItemRepository.save(item);
  }

  async update(
    purchaseOrderId: string,
    itemId: string,
    dto: UpdatePurchaseOrderItemDto,
    companyId: string,
  ) {
    await this.purchaseOrdersService.ensureIsDraft(purchaseOrderId, companyId);

    const item = await this.findItem(purchaseOrderId, itemId);

    Object.assign(item, dto);

    return await this.purchaseOrderItemRepository.save(item);
  }

  async remove(purchaseOrderId: string, itemId: string, companyId: string) {
    await this.purchaseOrdersService.ensureIsDraft(purchaseOrderId, companyId);

    const item = await this.findItem(purchaseOrderId, itemId);

    // TypeORM's remove() strips the primary key off the returned
    // entity, so the id is put back for the client.
    const removed = await this.purchaseOrderItemRepository.remove(item);

    return { ...removed, id: itemId };
  }

  private async findItem(purchaseOrderId: string, itemId: string) {
    const item = await this.purchaseOrderItemRepository.findOneBy({
      id: itemId,
      purchaseOrderId,
    });

    if (!item) {
      throw new NotFoundException('Purchase order item not found');
    }

    return item;
  }
}
