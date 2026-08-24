import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { RolesService } from 'src/roles/roles.service';
import { Role } from 'src/roles/entities/role.entity';

const COMPANY_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const OWNER_ROLE_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_ROLE_ID = '44444444-4444-4444-8444-444444444444';

function fakeUser(overrides: Partial<User> = {}): User {
  return {
    id: USER_ID,
    email: 'ali@abc.com',
    firstName: 'Ali',
    isActive: true,
    companyId: COMPANY_ID,
    roleId: OWNER_ROLE_ID,
    role: { id: OWNER_ROLE_ID, isOwnerRole: true } as Role,
    ...overrides,
  } as User;
}

describe('UsersService', () => {
  let service: UsersService;
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    countBy: jest.Mock;
  };
  let rolesService: { findOne: jest.Mock };

  beforeEach(() => {
    repo = {
      create: jest.fn((data: Partial<User>) => data as User),
      save: jest.fn((row: User) => Promise.resolve(row)),
      findOne: jest.fn(),
      countBy: jest.fn(),
    };
    rolesService = { findOne: jest.fn() };

    service = new UsersService(
      repo as unknown as Repository<User>,
      rolesService as unknown as RolesService,
    );
  });

  describe('create', () => {
    it('rejects a roleId that does not belong to the caller company', async () => {
      rolesService.findOne.mockRejectedValue(new NotFoundException('Role not found'));

      await expect(
        service.create({
          email: 'ali@abc.com',
          password: 'hash',
          firstName: 'Ali',
          companyId: COMPANY_ID,
          roleId: OTHER_ROLE_ID,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(repo.save).not.toHaveBeenCalled();
    });

    it('skips the roleId check when running inside a transaction manager', async () => {
      const manager = { getRepository: () => repo } as never;

      await service.create(
        {
          email: 'ali@abc.com',
          password: 'hash',
          firstName: 'Ali',
          companyId: COMPANY_ID,
          roleId: OWNER_ROLE_ID,
        },
        manager,
      );

      expect(rolesService.findOne).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('refuses to deactivate the last active Owner', async () => {
      repo.findOne.mockResolvedValue(fakeUser());
      repo.countBy.mockResolvedValue(0);

      await expect(
        service.update(USER_ID, { isActive: false }, COMPANY_ID),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(repo.save).not.toHaveBeenCalled();
    });

    it('refuses to move the last active Owner to another role', async () => {
      repo.findOne.mockResolvedValue(fakeUser());
      repo.countBy.mockResolvedValue(0);

      await expect(
        service.update(USER_ID, { roleId: OTHER_ROLE_ID }, COMPANY_ID),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('allows deactivating an Owner when another active Owner remains', async () => {
      repo.findOne
        .mockResolvedValueOnce(fakeUser())
        .mockResolvedValueOnce(fakeUser({ isActive: false }));
      repo.countBy.mockResolvedValue(1);

      const result = await service.update(USER_ID, { isActive: false }, COMPANY_ID);

      expect(repo.save).toHaveBeenCalled();
      expect(result.isActive).toBe(false);
    });

    it('allows changing a non-Owner user freely', async () => {
      repo.findOne.mockResolvedValue(
        fakeUser({ role: { id: OTHER_ROLE_ID, isOwnerRole: false } as Role }),
      );

      await service.update(USER_ID, { isActive: false }, COMPANY_ID);

      expect(repo.countBy).not.toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });
  });
});
