import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { GoodsReceiptItemsService } from './goods-receipt-items.service';
import { GoodsReceiptsService } from './goods-receipts.service';
import { GoodsReceipt } from './entities/goods-receipt.entity';
import { GoodsReceiptItem } from './entities/goods-receipt-item.entity';
import { GoodsReceiptStatus } from './enums/goods-receipt-status.enum';
import { PurchaseOrderItem } from 'src/purchases/entities/purchase-order-item.entity';

const COMPANY_ID = '33333333-3333-4333-8333-333333333333';
const PURCHASE_ORDER_ID = '11111111-1111-4111-8111-111111111111';
const ORDER_ITEM_ID = '55555555-5555-4555-8555-555555555555';
const RECEIPT_ID = '66666666-6666-4666-8666-666666666666';
const ITEM_ID = '77777777-7777-4777-8777-777777777777';
const PRODUCT_ID = '44444444-4444-4444-8444-444444444444';

function orderItem(quantity = 10): PurchaseOrderItem {
  return {
    id: ORDER_ITEM_ID,
    purchaseOrderId: PURCHASE_ORDER_ID,
    productId: PRODUCT_ID,
    quantity,
  } as PurchaseOrderItem;
}

function draftReceipt(items: Partial<GoodsReceiptItem>[] = []): GoodsReceipt {
  return {
    id: RECEIPT_ID,
    companyId: COMPANY_ID,
    purchaseOrderId: PURCHASE_ORDER_ID,
    status: GoodsReceiptStatus.DRAFT,
    items,
  } as GoodsReceipt;
}

describe('GoodsReceiptItemsService', () => {
  let goodsReceiptItemRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOneBy: jest.Mock;
    remove: jest.Mock;
  };
  let purchaseOrderItemRepo: { findOneBy: jest.Mock };
  let goodsReceiptsService: {
    ensureIsDraft: jest.Mock;
    getConfirmedReceivedQuantity: jest.Mock;
  };
  let service: GoodsReceiptItemsService;

  beforeEach(() => {
    goodsReceiptItemRepo = {
      create: jest.fn((data: object) => ({ ...data })),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      findOneBy: jest.fn(),
      remove: jest.fn((entity: unknown) => Promise.resolve(entity)),
    };
    purchaseOrderItemRepo = { findOneBy: jest.fn() };
    goodsReceiptsService = {
      ensureIsDraft: jest.fn(),
      getConfirmedReceivedQuantity: jest.fn().mockResolvedValue(0),
    };

    service = new GoodsReceiptItemsService(
      goodsReceiptItemRepo as unknown as Repository<GoodsReceiptItem>,
      purchaseOrderItemRepo as unknown as Repository<PurchaseOrderItem>,
      goodsReceiptsService as unknown as GoodsReceiptsService,
    );
  });

  describe('create', () => {
    it('refuses to add a line once the receipt is confirmed', async () => {
      goodsReceiptsService.ensureIsDraft.mockRejectedValue(
        new BadRequestException('Only a draft goods receipt can be modified.'),
      );

      await expect(
        service.create(
          RECEIPT_ID,
          { purchaseOrderItemId: ORDER_ITEM_ID, quantityReceived: 3 },
          COMPANY_ID,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a purchase order item that is not on this order', async () => {
      goodsReceiptsService.ensureIsDraft.mockResolvedValue(draftReceipt());
      purchaseOrderItemRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.create(
          RECEIPT_ID,
          { purchaseOrderItemId: ORDER_ITEM_ID, quantityReceived: 3 },
          COMPANY_ID,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('adds a line within the remaining quantity', async () => {
      goodsReceiptsService.ensureIsDraft.mockResolvedValue(draftReceipt());
      purchaseOrderItemRepo.findOneBy.mockResolvedValue(orderItem(10));

      const result = await service.create(
        RECEIPT_ID,
        { purchaseOrderItemId: ORDER_ITEM_ID, quantityReceived: 4 },
        COMPANY_ID,
      );

      expect(result).toMatchObject({
        goodsReceiptId: RECEIPT_ID,
        productId: PRODUCT_ID,
        quantityReceived: 4,
      });
    });

    it('accounts for other confirmed receipts against the same line', async () => {
      goodsReceiptsService.ensureIsDraft.mockResolvedValue(draftReceipt());
      purchaseOrderItemRepo.findOneBy.mockResolvedValue(orderItem(10));
      goodsReceiptsService.getConfirmedReceivedQuantity.mockResolvedValue(7);

      await expect(
        service.create(
          RECEIPT_ID,
          { purchaseOrderItemId: ORDER_ITEM_ID, quantityReceived: 4 },
          COMPANY_ID,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accounts for another line on the same draft receipt targeting the same order item', async () => {
      const receipt = draftReceipt([
        {
          id: 'other-line',
          purchaseOrderItemId: ORDER_ITEM_ID,
          quantityReceived: 8,
        },
      ]);
      goodsReceiptsService.ensureIsDraft.mockResolvedValue(receipt);
      purchaseOrderItemRepo.findOneBy.mockResolvedValue(orderItem(10));

      await expect(
        service.create(
          RECEIPT_ID,
          { purchaseOrderItemId: ORDER_ITEM_ID, quantityReceived: 4 },
          COMPANY_ID,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update', () => {
    it('excludes the line being edited from its own remaining-quantity check', async () => {
      const receipt = draftReceipt([
        {
          id: ITEM_ID,
          purchaseOrderItemId: ORDER_ITEM_ID,
          quantityReceived: 4,
        },
      ]);
      goodsReceiptsService.ensureIsDraft.mockResolvedValue(receipt);
      goodsReceiptItemRepo.findOneBy.mockResolvedValue({
        id: ITEM_ID,
        goodsReceiptId: RECEIPT_ID,
        purchaseOrderItemId: ORDER_ITEM_ID,
        quantityReceived: 4,
      });
      purchaseOrderItemRepo.findOneBy.mockResolvedValue(orderItem(10));

      // Raising 4 -> 9 on a line of 10 with nothing else committed must be
      // allowed — a naive check that didn't exclude this item's own current
      // 4 would see only 6 remaining and wrongly refuse it... but 9 <= 10 so
      // it should succeed either way. Use a value that only passes when the
      // item excludes itself.
      const result = await service.update(
        RECEIPT_ID,
        ITEM_ID,
        { quantityReceived: 10 },
        COMPANY_ID,
      );

      expect(result.quantityReceived).toBe(10);
    });

    it('still refuses a raise that would overshoot the order line', async () => {
      const receipt = draftReceipt([
        {
          id: ITEM_ID,
          purchaseOrderItemId: ORDER_ITEM_ID,
          quantityReceived: 4,
        },
      ]);
      goodsReceiptsService.ensureIsDraft.mockResolvedValue(receipt);
      goodsReceiptItemRepo.findOneBy.mockResolvedValue({
        id: ITEM_ID,
        goodsReceiptId: RECEIPT_ID,
        purchaseOrderItemId: ORDER_ITEM_ID,
        quantityReceived: 4,
      });
      purchaseOrderItemRepo.findOneBy.mockResolvedValue(orderItem(10));
      goodsReceiptsService.getConfirmedReceivedQuantity.mockResolvedValue(2);

      // 2 confirmed elsewhere + this line raised to 9 = 11 > 10 ordered.
      await expect(
        service.update(
          RECEIPT_ID,
          ITEM_ID,
          { quantityReceived: 9 },
          COMPANY_ID,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('remove', () => {
    it('removes a line from a draft receipt', async () => {
      goodsReceiptsService.ensureIsDraft.mockResolvedValue(draftReceipt());
      goodsReceiptItemRepo.findOneBy.mockResolvedValue({
        id: ITEM_ID,
        goodsReceiptId: RECEIPT_ID,
      });

      await service.remove(RECEIPT_ID, ITEM_ID, COMPANY_ID);

      expect(goodsReceiptsService.ensureIsDraft).toHaveBeenCalledWith(
        RECEIPT_ID,
        COMPANY_ID,
      );
      expect(goodsReceiptItemRepo.remove).toHaveBeenCalled();
    });

    it('refuses to remove a line once the receipt is confirmed', async () => {
      goodsReceiptsService.ensureIsDraft.mockRejectedValue(
        new BadRequestException('Only a draft goods receipt can be modified.'),
      );

      await expect(
        service.remove(RECEIPT_ID, ITEM_ID, COMPANY_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
