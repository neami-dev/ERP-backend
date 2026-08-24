import { BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';

import { StockMovementsService } from './stock-movements.service';
import {
  StockMovement,
  StockMovementReferenceType,
  StockMovementType,
} from './entities/stock-movement.entity';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { InventoriesService } from 'src/inventories/inventories.service';

const COMPANY_ID = '33333333-3333-4333-8333-333333333333';

/**
 * Which kind of OUT a movement is comes from the request, not from the stock
 * row — only the caller knows whether this customer had reserved. These tests
 * cover that decision and the record it leaves behind; the arithmetic itself
 * is covered in `inventories.service.spec.ts`.
 */
describe('StockMovementsService', () => {
  let service: StockMovementsService;
  let applyMovement: jest.Mock;
  let saved: StockMovement[];

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    saved = [];
    applyMovement = jest.fn().mockResolvedValue(undefined);

    const manager = {
      findOneBy: jest.fn().mockResolvedValue({ id: 'exists' }),
      create: jest.fn((_entity: unknown, data: object) => ({ ...data })),
      save: jest.fn((row: StockMovement) => {
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

    const repo = {
      manager: { connection: { createQueryRunner: () => queryRunner } },
    } as unknown as Repository<StockMovement>;

    service = new StockMovementsService(repo, {
      applyMovement,
    } as unknown as InventoriesService);
  });

  function dto(overrides: Partial<CreateStockMovementDto> = {}) {
    return {
      productId: '11111111-1111-4111-8111-111111111111',
      warehouseId: '22222222-2222-4222-8222-222222222222',
      type: StockMovementType.OUT,
      quantity: 5,
      referenceType: StockMovementReferenceType.SALES_ORDER,
      referenceId: '55555555-5555-4555-8555-555555555555',
      ...overrides,
    } as CreateStockMovementDto;
  }

  it('treats an OUT as a walk-in when nothing says otherwise', async () => {
    await service.create(dto(), COMPANY_ID);

    expect(applyMovement).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.any(String),
      COMPANY_ID,
      StockMovementType.OUT,
      5,
      false,
    );
  });

  it('passes the reservation intent through to the stock rules', async () => {
    await service.create(dto({ fromReservation: true }), COMPANY_ID);

    expect(applyMovement).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.any(String),
      COMPANY_ID,
      StockMovementType.OUT,
      5,
      true,
    );
  });

  it('records which kind of OUT it was, so the history explains the counts', async () => {
    await service.create(dto({ fromReservation: true }), COMPANY_ID);

    expect(saved[0]).toMatchObject({
      type: StockMovementType.OUT,
      quantity: 5,
      fromReservation: true,
    });
  });

  it('records a walk-in as such', async () => {
    await service.create(dto(), COMPANY_ID);

    expect(saved[0]).toMatchObject({ fromReservation: false });
  });

  it.each([
    StockMovementType.IN,
    StockMovementType.RESERVE,
    StockMovementType.RELEASE,
    StockMovementType.ADJUSTMENT,
  ])('refuses fromReservation on a %s', async (type) => {
    const body = dto({
      type,
      fromReservation: true,
      referenceType: StockMovementReferenceType.ADJUSTMENT,
    });

    await expect(service.create(body, COMPANY_ID)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(applyMovement).not.toHaveBeenCalled();
  });

  it('still requires a referenceId for everything but an adjustment', async () => {
    await expect(
      service.create(dto({ referenceId: undefined }), COMPANY_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('still refuses an adjustment of zero', async () => {
    const body = dto({
      type: StockMovementType.ADJUSTMENT,
      quantity: 0,
      referenceType: StockMovementReferenceType.ADJUSTMENT,
      referenceId: undefined,
    });

    await expect(service.create(body, COMPANY_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rolls back the movement when the stock rules refuse it', async () => {
    applyMovement.mockRejectedValueOnce(
      new ConflictException('Insufficient reserved stock'),
    );

    await expect(
      service.create(dto({ fromReservation: true }), COMPANY_ID),
    ).rejects.toBeInstanceOf(ConflictException);

    // Stock and its audit record share one transaction: neither survives alone.
    expect(saved).toHaveLength(0);
  });
});
