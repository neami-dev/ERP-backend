import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';

import { RolesService } from './roles.service';
import { Role } from './entities/role.entity';
import { ALL_PERMISSIONS, Permission } from 'src/common/permissions/permission';

const COMPANY_ID = '11111111-1111-4111-8111-111111111111';
const ROLE_ID = '22222222-2222-4222-8222-222222222222';

function fakeRole(overrides: Partial<Role> = {}): Role {
  return {
    id: ROLE_ID,
    name: 'Employee',
    permissions: [],
    isOwnerRole: false,
    companyId: COMPANY_ID,
    ...overrides,
  } as Role;
}

describe('RolesService', () => {
  let service: RolesService;
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    findBy: jest.Mock;
    findOneBy: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(() => {
    repo = {
      create: jest.fn((data: Partial<Role>) => data as Role),
      save: jest.fn((row: Role) => Promise.resolve(row)),
      findBy: jest.fn(),
      findOneBy: jest.fn(),
      remove: jest.fn((row: Role) => Promise.resolve({ ...row, id: undefined })),
    };

    service = new RolesService(repo as unknown as Repository<Role>);
  });

  describe('createOwnerRole', () => {
    it('grants every catalog permission and sets isOwnerRole', async () => {
      const role = await service.createOwnerRole(COMPANY_ID);

      expect(role.isOwnerRole).toBe(true);
      expect(role.name).toBe('Owner');
      expect(role.permissions).toEqual(ALL_PERMISSIONS);
      expect(role.companyId).toBe(COMPANY_ID);
    });
  });

  describe('create', () => {
    it('turns a duplicate-name constraint violation into a 409', async () => {
      repo.save.mockRejectedValue(
        new QueryFailedError('INSERT', [], { code: '23505' } as never),
      );

      await expect(
        service.create(
          { name: 'Employee', permissions: [Permission.PRODUCTS_READ] },
          COMPANY_ID,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the role does not belong to the company', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.findOne(ROLE_ID, COMPANY_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('refuses to change the Owner role', async () => {
      repo.findOneBy.mockResolvedValue(fakeRole({ isOwnerRole: true }));

      await expect(
        service.update(ROLE_ID, { name: 'Renamed' }, COMPANY_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(repo.save).not.toHaveBeenCalled();
    });

    it('updates a regular role', async () => {
      repo.findOneBy.mockResolvedValue(fakeRole());

      const result = await service.update(
        ROLE_ID,
        { permissions: [Permission.PRODUCTS_READ] },
        COMPANY_ID,
      );

      expect(result.permissions).toEqual([Permission.PRODUCTS_READ]);
    });
  });

  describe('remove', () => {
    it('refuses to delete the Owner role', async () => {
      repo.findOneBy.mockResolvedValue(fakeRole({ isOwnerRole: true }));

      await expect(service.remove(ROLE_ID, COMPANY_ID)).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('turns a role still assigned to users into a 409', async () => {
      repo.findOneBy.mockResolvedValue(fakeRole());
      repo.remove.mockRejectedValue(
        new QueryFailedError('DELETE', [], { code: '23503' } as never),
      );

      await expect(service.remove(ROLE_ID, COMPANY_ID)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });
});
