import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrder } from '../entities/purchase-order.entity';
import { PurchaseOrderStatus } from '../enums/purchase-order-status.enum';
import { Supplier } from 'src/suppliers/entities/supplier.entity';
import { DocumentNumberService } from 'src/common/ document-number/document-number.service';

const COMPANY_ID = '33333333-3333-4333-8333-333333333333';
const ORDER_ID = '11111111-1111-4111-8111-111111111111';

function order(status: PurchaseOrderStatus): PurchaseOrder {
  return { id: ORDER_ID, companyId: COMPANY_ID, status } as PurchaseOrder;
}

/**
 * `receive()` used to raise stock and write a stock movement; that moved to
 * `GoodsReceiptsService.confirm()`. These tests cover what is left: a plain
 * status flag, and the (partially-)received guards on `remove()`/`cancel()`
 * that grew to cover the new PARTIALLY_RECEIVED status.
 */
describe('PurchaseOrdersService', () => {
  let purchaseOrderRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };
  let service: PurchaseOrdersService;

  beforeEach(() => {
    purchaseOrderRepo = {
      findOne: jest.fn(),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      remove: jest.fn(),
    };

    service = new PurchaseOrdersService(
      purchaseOrderRepo as unknown as Repository<PurchaseOrder>,
      {} as Repository<Supplier>,
      {} as DocumentNumberService,
      {} as DataSource,
    );
  });

  describe('receive', () => {
    it.each([
      PurchaseOrderStatus.CONFIRMED,
      PurchaseOrderStatus.PARTIALLY_RECEIVED,
    ])('marks a %s order RECEIVED without touching stock', async (status) => {
      purchaseOrderRepo.findOne.mockResolvedValue(order(status));

      const result = await service.receive(ORDER_ID, COMPANY_ID);

      expect(result.status).toBe(PurchaseOrderStatus.RECEIVED);
    });

    it.each([
      PurchaseOrderStatus.DRAFT,
      PurchaseOrderStatus.RECEIVED,
      PurchaseOrderStatus.CANCELLED,
    ])('refuses to receive a %s order', async (status) => {
      purchaseOrderRepo.findOne.mockResolvedValue(order(status));

      await expect(
        service.receive(ORDER_ID, COMPANY_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('does not exist outside the caller company', async () => {
      purchaseOrderRepo.findOne.mockResolvedValue(null);

      await expect(
        service.receive(ORDER_ID, COMPANY_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('refuses to cancel a partially received order', async () => {
      purchaseOrderRepo.findOne.mockResolvedValue(
        order(PurchaseOrderStatus.PARTIALLY_RECEIVED),
      );

      await expect(service.cancel(ORDER_ID, COMPANY_ID)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('remove', () => {
    it('refuses to delete a partially received order', async () => {
      purchaseOrderRepo.findOne.mockResolvedValue(
        order(PurchaseOrderStatus.PARTIALLY_RECEIVED),
      );

      await expect(service.remove(ORDER_ID, COMPANY_ID)).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(purchaseOrderRepo.remove).not.toHaveBeenCalled();
    });
  });
});
