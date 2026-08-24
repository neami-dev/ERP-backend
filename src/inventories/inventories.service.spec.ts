import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { QueryRunner, Repository } from 'typeorm';

import { InventoriesService } from './inventories.service';
import { Inventory } from './entities/inventory.entity';
import { Product } from 'src/products/entities/product.entity';
import { Warehouse } from 'src/warehouses/entities/warehouse.entity';
import { StockMovementType } from 'src/stock-movements/entities/stock-movement.entity';

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const WAREHOUSE_ID = '22222222-2222-4222-8222-222222222222';
const COMPANY_ID = '33333333-3333-4333-8333-333333333333';

type StockRow = Pick<Inventory, 'quantityOnHand' | 'quantityReserved'> &
  Partial<Inventory>;

/**
 * The stock row `applyMovement` will find, load-locked, and mutate in place.
 * Passing `null` stands for "no stock row yet".
 */
function stockRow(quantityOnHand: number, quantityReserved = 0): StockRow {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    productId: PRODUCT_ID,
    warehouseId: WAREHOUSE_ID,
    companyId: COMPANY_ID,
    quantityOnHand,
    quantityReserved,
  };
}

/**
 * A QueryRunner that answers with `existing` and remembers what was saved.
 *
 * The query-builder chain is mocked rather than stubbed away so the test can
 * assert the row really is locked before it is read — that lock is what stops
 * two concurrent movements overwriting each other, and it is invisible in the
 * resulting quantities.
 */
function fakeQueryRunner(
  existing: StockRow | null,
  {
    product = {},
    warehouse = {},
  }: { product?: unknown; warehouse?: unknown } = {},
) {
  const queryBuilder = {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(existing),
  };

  const saved: unknown[] = [];

  const manager = {
    getRepository: jest
      .fn()
      .mockReturnValue({ createQueryBuilder: () => queryBuilder }),
    findOneBy: jest.fn((entity: unknown) => {
      if (entity === Product) return Promise.resolve(product);
      if (entity === Warehouse) return Promise.resolve(warehouse);
      return Promise.resolve(null);
    }),
    create: jest.fn((_entity: unknown, data: object) => ({ ...data })),
    save: jest.fn((row: unknown) => {
      saved.push(row);
      return Promise.resolve(row);
    }),
  };

  return {
    queryRunner: { manager } as unknown as QueryRunner,
    queryBuilder,
    manager,
    saved,
  };
}

describe('InventoriesService.applyMovement', () => {
  let service: InventoriesService;

  beforeAll(() => {
    // The service logs every movement; a passing run should stay readable.
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    // applyMovement works entirely through the caller's QueryRunner, so the
    // injected repository is never touched on this path.
    service = new InventoriesService({} as Repository<Inventory>);
  });

  /** Runs one movement against a stock row and returns the row after it. */
  async function apply(
    row: StockRow | null,
    type: StockMovementType,
    quantity: number,
    fromReservation?: boolean,
  ) {
    const { queryRunner, queryBuilder, manager, saved } = fakeQueryRunner(row);

    await service.applyMovement(
      queryRunner,
      PRODUCT_ID,
      WAREHOUSE_ID,
      COMPANY_ID,
      type,
      quantity,
      fromReservation,
    );

    return { row, queryBuilder, manager, saved };
  }

  /** The invariants that must hold after every successful movement. */
  function expectInvariants(row: StockRow) {
    expect(row.quantityReserved).toBeGreaterThanOrEqual(0);
    expect(row.quantityOnHand).toBeGreaterThanOrEqual(row.quantityReserved);
    expect(row.quantityOnHand - row.quantityReserved).toBeGreaterThanOrEqual(0);
  }

  describe('A — direct OUT, nothing was reserved', () => {
    it('takes from on hand and leaves the reservation alone', async () => {
      const row = stockRow(100, 20);

      await apply(row, StockMovementType.OUT, 10);

      expect(row.quantityOnHand).toBe(90);
      expect(row.quantityReserved).toBe(20);
      expect(row.quantityOnHand - row.quantityReserved).toBe(70);
      expectInvariants(row);
    });

    it('may take everything that is available', async () => {
      const row = stockRow(100, 20);

      await apply(row, StockMovementType.OUT, 80);

      expect(row.quantityOnHand).toBe(20);
      expect(row.quantityReserved).toBe(20);
      expectInvariants(row);
    });
  });

  describe('B — OUT collecting a reservation', () => {
    it('takes from on hand and from the reservation together', async () => {
      const row = stockRow(100, 20);

      await apply(row, StockMovementType.OUT, 20, true);

      expect(row.quantityOnHand).toBe(80);
      expect(row.quantityReserved).toBe(0);
      expect(row.quantityOnHand - row.quantityReserved).toBe(80);
      expectInvariants(row);
    });

    it('collects part of a reservation and leaves the rest reserved', async () => {
      const row = stockRow(100, 20);

      await apply(row, StockMovementType.OUT, 5, true);

      expect(row.quantityOnHand).toBe(95);
      expect(row.quantityReserved).toBe(15);
      expectInvariants(row);
    });

    it('ignores available stock — a reservation is collectable when nothing is free', async () => {
      // Everything on the shelf is spoken for: a walk-in would be refused,
      // but the customer who reserved it may still collect.
      const row = stockRow(20, 20);

      await apply(row, StockMovementType.OUT, 20, true);

      expect(row.quantityOnHand).toBe(0);
      expect(row.quantityReserved).toBe(0);
      expectInvariants(row);
    });
  });

  describe('C — RESERVE then RELEASE', () => {
    it('sets stock aside without moving it, then frees it again', async () => {
      const row = stockRow(100, 0);

      await apply(row, StockMovementType.RESERVE, 20);

      expect(row.quantityOnHand).toBe(100);
      expect(row.quantityReserved).toBe(20);
      expect(row.quantityOnHand - row.quantityReserved).toBe(80);
      expectInvariants(row);

      await apply(row, StockMovementType.RELEASE, 20);

      expect(row.quantityOnHand).toBe(100);
      expect(row.quantityReserved).toBe(0);
      expect(row.quantityOnHand - row.quantityReserved).toBe(100);
      expectInvariants(row);
    });

    it('refuses to reserve more than is available', async () => {
      const row = stockRow(100, 90);

      await expect(
        apply(row, StockMovementType.RESERVE, 20),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(row.quantityReserved).toBe(90);
    });

    it('refuses to release more than is reserved', async () => {
      const row = stockRow(100, 5);

      await expect(apply(row, StockMovementType.RELEASE, 10)).rejects.toThrow(
        'Insufficient reserved stock to release',
      );

      expect(row.quantityReserved).toBe(5);
    });
  });

  describe('D — RESERVE then OUT, the whole customer journey', () => {
    it('reserves, collects, and leaves the counts consistent', async () => {
      const row = stockRow(100, 0);

      await apply(row, StockMovementType.RESERVE, 20);
      await apply(row, StockMovementType.OUT, 20, true);

      expect(row.quantityOnHand).toBe(80);
      expect(row.quantityReserved).toBe(0);
      expect(row.quantityOnHand - row.quantityReserved).toBe(80);
      expectInvariants(row);
    });

    it('does not double-count when a reserved collection is booked as a walk-in', async () => {
      // The bug this change fixes: the goods leave, but the reservation stays
      // standing over stock that is no longer there.
      const row = stockRow(100, 20);

      await apply(row, StockMovementType.OUT, 20, false);

      expect(row.quantityOnHand).toBe(80);
      expect(row.quantityReserved).toBe(20);
      // Available is now 60, not 80 — which is why the caller has to say
      // which kind of OUT this was.
      expect(row.quantityOnHand - row.quantityReserved).toBe(60);
    });
  });

  describe('E — not enough available for a direct OUT', () => {
    it('refuses to take stock that is reserved for someone else', async () => {
      const row = stockRow(100, 90);

      await expect(apply(row, StockMovementType.OUT, 20)).rejects.toThrow(
        'Insufficient available stock (available: 10, requested: 20)',
      );

      expect(row.quantityOnHand).toBe(100);
      expect(row.quantityReserved).toBe(90);
    });

    it('leaves the row untouched when it refuses', async () => {
      const row = stockRow(5, 0);
      const { saved } = fakeQueryRunner(row);

      await expect(apply(row, StockMovementType.OUT, 6)).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(row.quantityOnHand).toBe(5);
      expect(saved).toHaveLength(0);
    });
  });

  describe('F — not enough reserved for a reservation OUT', () => {
    it('refuses to collect more than was reserved', async () => {
      const row = stockRow(100, 5);

      await expect(apply(row, StockMovementType.OUT, 10, true)).rejects.toThrow(
        'Insufficient reserved stock (reserved: 5, requested: 10)',
      );

      expect(row.quantityOnHand).toBe(100);
      expect(row.quantityReserved).toBe(5);
    });

    it('refuses when nothing is reserved at all, however much is on the shelf', async () => {
      const row = stockRow(100, 0);

      await expect(
        apply(row, StockMovementType.OUT, 1, true),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(row.quantityOnHand).toBe(100);
    });
  });

  describe('G — invalid quantities', () => {
    it.each([
      [StockMovementType.IN, 0],
      [StockMovementType.IN, -5],
      [StockMovementType.OUT, 0],
      [StockMovementType.OUT, -5],
      [StockMovementType.RESERVE, 0],
      [StockMovementType.RESERVE, -5],
      [StockMovementType.RELEASE, 0],
      [StockMovementType.RELEASE, -5],
    ])('refuses %s of %d', async (type, quantity) => {
      const row = stockRow(100, 50);

      await expect(apply(row, type, quantity)).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(row.quantityOnHand).toBe(100);
      expect(row.quantityReserved).toBe(50);
    });

    it('refuses a negative reserved OUT as well', async () => {
      const row = stockRow(100, 50);

      await expect(
        apply(row, StockMovementType.OUT, -5, true),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(row.quantityReserved).toBe(50);
    });

    it('refuses an unknown movement type', async () => {
      const row = stockRow(100);

      await expect(
        apply(row, 'TRANSFER' as StockMovementType, 5),
      ).rejects.toThrow('Unsupported movement type');
    });
  });

  describe('H — locking and persistence', () => {
    it('locks the stock row FOR UPDATE before reading it', async () => {
      const row = stockRow(100);
      const { queryBuilder } = await apply(row, StockMovementType.IN, 5);

      expect(queryBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(queryBuilder.getOne).toHaveBeenCalled();
    });

    it('saves through the caller transaction, so it rolls back with it', async () => {
      const row = stockRow(100, 20);
      const { manager, saved } = await apply(
        row,
        StockMovementType.OUT,
        20,
        true,
      );

      expect(manager.save).toHaveBeenCalledTimes(1);
      expect(saved[0]).toBe(row);
      expect(row.quantityOnHand).toBe(80);
    });

    it('applies sequential movements to the same row cumulatively', async () => {
      // Two callers holding the lock in turn: each reads what the previous
      // one wrote, which is what the lock exists to guarantee.
      const row = stockRow(100, 0);

      await apply(row, StockMovementType.RESERVE, 30);
      await apply(row, StockMovementType.OUT, 10, true);
      await apply(row, StockMovementType.OUT, 40);
      await apply(row, StockMovementType.RELEASE, 20);

      expect(row.quantityOnHand).toBe(50);
      expect(row.quantityReserved).toBe(0);
      expectInvariants(row);
    });
  });

  describe('ADJUSTMENT — unchanged by this work', () => {
    it('corrects the count up and down', async () => {
      const row = stockRow(100, 0);

      await apply(row, StockMovementType.ADJUSTMENT, 5);
      expect(row.quantityOnHand).toBe(105);

      await apply(row, StockMovementType.ADJUSTMENT, -25);
      expect(row.quantityOnHand).toBe(80);
      expectInvariants(row);
    });

    it('refuses to take the count below zero', async () => {
      const row = stockRow(10, 0);

      await expect(
        apply(row, StockMovementType.ADJUSTMENT, -11),
      ).rejects.toThrow('would make stock negative');

      expect(row.quantityOnHand).toBe(10);
    });

    it('refuses to leave less on hand than is reserved', async () => {
      const row = stockRow(100, 60);

      await expect(
        apply(row, StockMovementType.ADJUSTMENT, -50),
      ).rejects.toThrow('less stock than is reserved');

      expect(row.quantityOnHand).toBe(100);
    });
  });

  describe('first movement for a product/warehouse pair', () => {
    it('creates the stock row, then applies the movement to it', async () => {
      const { queryRunner, manager, saved } = fakeQueryRunner(null);

      await service.applyMovement(
        queryRunner,
        PRODUCT_ID,
        WAREHOUSE_ID,
        COMPANY_ID,
        StockMovementType.IN,
        40,
      );

      expect(manager.create).toHaveBeenCalled();
      // Saved twice: once to create the empty row, once with the movement
      // applied to it.
      expect(manager.save).toHaveBeenCalledTimes(2);
      expect(saved.at(-1)).toMatchObject({
        quantityOnHand: 40,
        quantityReserved: 0,
      });
    });

    it('refuses when the product is not in this company', async () => {
      const { queryRunner } = fakeQueryRunner(null, { product: null });

      await expect(
        service.applyMovement(
          queryRunner,
          PRODUCT_ID,
          WAREHOUSE_ID,
          COMPANY_ID,
          StockMovementType.IN,
          40,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses when the warehouse is not in this company', async () => {
      const { queryRunner } = fakeQueryRunner(null, { warehouse: null });

      await expect(
        service.applyMovement(
          queryRunner,
          PRODUCT_ID,
          WAREHOUSE_ID,
          COMPANY_ID,
          StockMovementType.IN,
          40,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
