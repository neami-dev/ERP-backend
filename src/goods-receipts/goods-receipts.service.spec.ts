import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { GoodsReceiptsService } from './goods-receipts.service';
import { GoodsReceipt } from './entities/goods-receipt.entity';
import { GoodsReceiptItem } from './entities/goods-receipt-item.entity';
import { GoodsReceiptStatus } from './enums/goods-receipt-status.enum';
import { PurchaseOrder } from 'src/purchases/entities/purchase-order.entity';
import { PurchaseOrderItem } from 'src/purchases/entities/purchase-order-item.entity';
import { PurchaseOrderStatus } from 'src/purchases/enums/purchase-order-status.enum';
import { Warehouse } from 'src/warehouses/entities/warehouse.entity';
import { InventoriesService } from 'src/inventories/inventories.service';
import { StockMovementReferenceType } from 'src/stock-movements/entities/stock-movement.entity';
import { CreateGoodsReceiptDto } from './dto/create-goods-receipt.dto';

const COMPANY_ID = '33333333-3333-4333-8333-333333333333';
const PURCHASE_ORDER_ID = '11111111-1111-4111-8111-111111111111';
const WAREHOUSE_ID = '22222222-2222-4222-8222-222222222222';
const PRODUCT_ID = '44444444-4444-4444-8444-444444444444';
const ORDER_ITEM_ID = '55555555-5555-4555-8555-555555555555';
const RECEIPT_ID = '66666666-6666-4666-8666-666666666666';

function orderItem(
  overrides: Partial<PurchaseOrderItem> = {},
): PurchaseOrderItem {
  return {
    id: ORDER_ITEM_ID,
    purchaseOrderId: PURCHASE_ORDER_ID,
    productId: PRODUCT_ID,
    quantity: 10,
    unitCost: 5,
    ...overrides,
  } as PurchaseOrderItem;
}

function purchaseOrder(
  overrides: Partial<PurchaseOrder> = {},
  items: PurchaseOrderItem[] = [orderItem()],
): PurchaseOrder {
  return {
    id: PURCHASE_ORDER_ID,
    companyId: COMPANY_ID,
    status: PurchaseOrderStatus.CONFIRMED,
    items,
    ...overrides,
  } as PurchaseOrder;
}

/**
 * A query builder that answers `getRawMany` with the given rows — stands in
 * for `getReceivedQuantities`'s aggregate over confirmed receipt lines.
 */
function receivedQuantitiesQueryBuilder(
  rows: { purchaseOrderItemId: string; total: string }[],
) {
  return {
    innerJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rows),
  };
}

/**
 * The QueryRunner `confirm()` runs in. The purchase-order lock is a query
 * builder (so the test can see it really does lock the row before reading
 * it, same reasoning as `inventories.service.spec.ts`), everything else is a
 * plain manager method.
 */
function fakeQueryRunner(opts: {
  lockedOrder: PurchaseOrder | null;
  orderItems: PurchaseOrderItem[];
  receivedBeforeConfirm?: { purchaseOrderItemId: string; total: string }[];
  receivedAfterConfirm?: { purchaseOrderItemId: string; total: string }[];
}) {
  const saved: unknown[] = [];
  const created: unknown[] = [];

  const poQueryBuilder = {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(opts.lockedOrder),
  };

  let receivedCall = 0;
  const receivedCalls = [
    opts.receivedBeforeConfirm ?? [],
    opts.receivedAfterConfirm ?? [],
  ];

  const manager = {
    getRepository: jest.fn().mockReturnValue({
      createQueryBuilder: () => poQueryBuilder,
    }),
    findBy: jest.fn().mockResolvedValue(opts.orderItems),
    createQueryBuilder: jest.fn(() =>
      receivedQuantitiesQueryBuilder(receivedCalls[receivedCall++] ?? []),
    ),
    create: jest.fn((_entity: unknown, data: object) => {
      created.push(data);
      return { ...data };
    }),
    save: jest.fn((row: unknown) => {
      saved.push(row);
      return Promise.resolve(row);
    }),
  };

  const queryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager,
  };

  return { queryRunner, manager, poQueryBuilder, saved, created };
}

describe('GoodsReceiptsService', () => {
  let goodsReceiptRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
  };
  let goodsReceiptItemRepo: { create: jest.Mock };
  let purchaseOrderRepo: { findOne: jest.Mock };
  let warehouseRepo: { existsBy: jest.Mock };
  let inventoriesService: { applyMovement: jest.Mock };
  let dataSourceManagerQueryBuilder: ReturnType<
    typeof receivedQuantitiesQueryBuilder
  >;
  let queryRunner: ReturnType<typeof fakeQueryRunner>;
  let dataSource: { manager: unknown; createQueryRunner: jest.Mock };
  let service: GoodsReceiptsService;

  function createDto(
    overrides: Partial<CreateGoodsReceiptDto> = {},
  ): CreateGoodsReceiptDto {
    return {
      purchaseOrderId: PURCHASE_ORDER_ID,
      warehouseId: WAREHOUSE_ID,
      items: [{ purchaseOrderItemId: ORDER_ITEM_ID, quantityReceived: 4 }],
      ...overrides,
    };
  }

  function setUpQueryRunner(
    opts: Parameters<typeof fakeQueryRunner>[0] = {
      lockedOrder: purchaseOrder(),
      orderItems: [orderItem()],
    },
  ) {
    queryRunner = fakeQueryRunner(opts);
    dataSource.createQueryRunner.mockReturnValue(queryRunner.queryRunner);
    return queryRunner;
  }

  beforeEach(() => {
    goodsReceiptRepo = {
      create: jest.fn((data: object) => ({ ...data })),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      findOne: jest.fn(),
    };
    goodsReceiptItemRepo = {
      create: jest.fn((data: object) => ({ ...data })),
    };
    purchaseOrderRepo = { findOne: jest.fn() };
    warehouseRepo = { existsBy: jest.fn().mockResolvedValue(true) };
    inventoriesService = {
      applyMovement: jest.fn().mockResolvedValue(undefined),
    };

    dataSourceManagerQueryBuilder = receivedQuantitiesQueryBuilder([]);
    dataSource = {
      manager: {
        createQueryBuilder: jest.fn(() => dataSourceManagerQueryBuilder),
      },
      createQueryRunner: jest.fn(),
    };

    service = new GoodsReceiptsService(
      goodsReceiptRepo as unknown as Repository<GoodsReceipt>,
      goodsReceiptItemRepo as unknown as Repository<GoodsReceiptItem>,
      purchaseOrderRepo as unknown as Repository<PurchaseOrder>,
      warehouseRepo as unknown as Repository<Warehouse>,
      inventoriesService as unknown as InventoriesService,
      dataSource as unknown as DataSource,
    );
  });

  describe('create', () => {
    it('rejects a purchase order that has not been confirmed', async () => {
      purchaseOrderRepo.findOne.mockResolvedValue(
        purchaseOrder({ status: PurchaseOrderStatus.DRAFT }),
      );

      await expect(
        service.create(createDto(), COMPANY_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an order that does not belong to this company', async () => {
      purchaseOrderRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create(createDto(), COMPANY_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a warehouse outside this company', async () => {
      purchaseOrderRepo.findOne.mockResolvedValue(purchaseOrder());
      warehouseRepo.existsBy.mockResolvedValue(false);

      await expect(
        service.create(createDto(), COMPANY_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a line that does not belong to the order', async () => {
      purchaseOrderRepo.findOne.mockResolvedValue(purchaseOrder());

      await expect(
        service.create(
          createDto({
            items: [
              { purchaseOrderItemId: 'not-on-order', quantityReceived: 1 },
            ],
          }),
          COMPANY_ID,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects receiving more than remains on the line', async () => {
      purchaseOrderRepo.findOne.mockResolvedValue(
        purchaseOrder({}, [orderItem({ quantity: 10 })]),
      );
      // 7 already confirmed-received, only 3 remain.
      dataSourceManagerQueryBuilder.getRawMany.mockResolvedValue([
        { purchaseOrderItemId: ORDER_ITEM_ID, total: '7' },
      ]);

      await expect(
        service.create(
          createDto({
            items: [
              { purchaseOrderItemId: ORDER_ITEM_ID, quantityReceived: 4 },
            ],
          }),
          COMPANY_ID,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects two lines in the same request that jointly overshoot one order line', async () => {
      purchaseOrderRepo.findOne.mockResolvedValue(
        purchaseOrder({}, [orderItem({ quantity: 10 })]),
      );

      // Neither line overshoots on its own (6 and 6 both <= 10), but
      // together they ask for 12 against a line of 10.
      await expect(
        service.create(
          createDto({
            items: [
              { purchaseOrderItemId: ORDER_ITEM_ID, quantityReceived: 6 },
              { purchaseOrderItemId: ORDER_ITEM_ID, quantityReceived: 6 },
            ],
          }),
          COMPANY_ID,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a draft receipt scoped to the caller company, stock untouched', async () => {
      purchaseOrderRepo.findOne.mockResolvedValue(purchaseOrder());

      const result = await service.create(createDto(), COMPANY_ID);

      expect(result).toMatchObject({
        purchaseOrderId: PURCHASE_ORDER_ID,
        warehouseId: WAREHOUSE_ID,
        companyId: COMPANY_ID,
        status: GoodsReceiptStatus.DRAFT,
      });
      expect(inventoriesService.applyMovement).not.toHaveBeenCalled();
    });

    it('accepts a partially received order', async () => {
      purchaseOrderRepo.findOne.mockResolvedValue(
        purchaseOrder({ status: PurchaseOrderStatus.PARTIALLY_RECEIVED }),
      );

      await expect(
        service.create(createDto(), COMPANY_ID),
      ).resolves.toBeDefined();
    });
  });

  describe('cancel', () => {
    it('cancels a draft receipt', async () => {
      goodsReceiptRepo.findOne.mockResolvedValue({
        id: RECEIPT_ID,
        companyId: COMPANY_ID,
        status: GoodsReceiptStatus.DRAFT,
      });

      const result = await service.cancel(RECEIPT_ID, COMPANY_ID);

      expect(result.status).toBe(GoodsReceiptStatus.CANCELLED);
    });

    it('refuses to cancel a confirmed receipt', async () => {
      goodsReceiptRepo.findOne.mockResolvedValue({
        id: RECEIPT_ID,
        companyId: COMPANY_ID,
        status: GoodsReceiptStatus.CONFIRMED,
      });

      await expect(
        service.cancel(RECEIPT_ID, COMPANY_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('confirm', () => {
    function draftReceipt(
      items: Partial<GoodsReceiptItem>[] = [
        {
          purchaseOrderItemId: ORDER_ITEM_ID,
          productId: PRODUCT_ID,
          quantityReceived: 4,
        },
      ],
    ) {
      return {
        id: RECEIPT_ID,
        companyId: COMPANY_ID,
        purchaseOrderId: PURCHASE_ORDER_ID,
        warehouseId: WAREHOUSE_ID,
        status: GoodsReceiptStatus.DRAFT,
        items,
      } as GoodsReceipt;
    }

    it('refuses to confirm a receipt that is not a draft', async () => {
      goodsReceiptRepo.findOne.mockResolvedValue({
        ...draftReceipt(),
        status: GoodsReceiptStatus.CONFIRMED,
      });

      await expect(
        service.confirm(RECEIPT_ID, COMPANY_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('raises stock and records a stock movement for every line', async () => {
      goodsReceiptRepo.findOne.mockResolvedValue(draftReceipt());
      setUpQueryRunner({
        lockedOrder: purchaseOrder(),
        orderItems: [orderItem({ quantity: 10 })],
        receivedBeforeConfirm: [],
        receivedAfterConfirm: [
          { purchaseOrderItemId: ORDER_ITEM_ID, total: '4' },
        ],
      });

      await service.confirm(RECEIPT_ID, COMPANY_ID);

      expect(inventoriesService.applyMovement).toHaveBeenCalledWith(
        queryRunner.queryRunner,
        PRODUCT_ID,
        WAREHOUSE_ID,
        COMPANY_ID,
        'IN',
        4,
      );
      expect(queryRunner.created).toContainEqual(
        expect.objectContaining({
          referenceType: StockMovementReferenceType.GOODS_RECEIPT,
          referenceId: RECEIPT_ID,
          quantity: 4,
        }),
      );
    });

    it('moves the order to PARTIALLY_RECEIVED when some quantity remains', async () => {
      goodsReceiptRepo.findOne.mockResolvedValue(draftReceipt());
      const order = purchaseOrder();
      setUpQueryRunner({
        lockedOrder: order,
        orderItems: [orderItem({ quantity: 10 })],
        receivedBeforeConfirm: [],
        receivedAfterConfirm: [
          { purchaseOrderItemId: ORDER_ITEM_ID, total: '4' },
        ],
      });

      await service.confirm(RECEIPT_ID, COMPANY_ID);

      expect(order.status).toBe(PurchaseOrderStatus.PARTIALLY_RECEIVED);
      expect(queryRunner.queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('moves the order to RECEIVED once every line is fully in', async () => {
      goodsReceiptRepo.findOne.mockResolvedValue(
        draftReceipt([
          {
            purchaseOrderItemId: ORDER_ITEM_ID,
            productId: PRODUCT_ID,
            quantityReceived: 10,
          },
        ]),
      );
      const order = purchaseOrder();
      setUpQueryRunner({
        lockedOrder: order,
        orderItems: [orderItem({ quantity: 10 })],
        receivedBeforeConfirm: [],
        receivedAfterConfirm: [
          { purchaseOrderItemId: ORDER_ITEM_ID, total: '10' },
        ],
      });

      await service.confirm(RECEIPT_ID, COMPANY_ID);

      expect(order.status).toBe(PurchaseOrderStatus.RECEIVED);
    });

    it('rolls back and rejects if two receipts together would overshoot the line', async () => {
      // 8 already confirmed elsewhere; this draft asks for 4 more on a
      // line of 10 — only the lock at confirm time catches this, since
      // `create()`'s own check ran before the other receipt was confirmed.
      goodsReceiptRepo.findOne.mockResolvedValue(draftReceipt());
      setUpQueryRunner({
        lockedOrder: purchaseOrder(),
        orderItems: [orderItem({ quantity: 10 })],
        receivedBeforeConfirm: [
          { purchaseOrderItemId: ORDER_ITEM_ID, total: '8' },
        ],
      });

      await expect(
        service.confirm(RECEIPT_ID, COMPANY_ID),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(queryRunner.queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(inventoriesService.applyMovement).not.toHaveBeenCalled();
    });

    it('rejects two lines on the same receipt that jointly overshoot the line', async () => {
      goodsReceiptRepo.findOne.mockResolvedValue(
        draftReceipt([
          {
            purchaseOrderItemId: ORDER_ITEM_ID,
            productId: PRODUCT_ID,
            quantityReceived: 6,
          },
          {
            purchaseOrderItemId: ORDER_ITEM_ID,
            productId: PRODUCT_ID,
            quantityReceived: 6,
          },
        ]),
      );
      setUpQueryRunner({
        lockedOrder: purchaseOrder(),
        orderItems: [orderItem({ quantity: 10 })],
        receivedBeforeConfirm: [],
      });

      await expect(
        service.confirm(RECEIPT_ID, COMPANY_ID),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(queryRunner.queryRunner.rollbackTransaction).toHaveBeenCalled();
      // The first line (6 of 10) is fine and applies; only the second
      // (which would bring the total to 12) must be refused.
      expect(inventoriesService.applyMovement).toHaveBeenCalledTimes(1);
    });
  });
});
