import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PermissionsGuard } from './permissions.guard';
import { RolesService } from 'src/roles/roles.service';
import { Role } from 'src/roles/entities/role.entity';
import { Permission } from 'src/common/permissions/permission';
import { JwtPayload } from '../auth.service';

function fakeContext(user?: JwtPayload): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let rolesService: { findOne: jest.Mock };

  const user: JwtPayload = {
    sub: 'user-1',
    email: 'ali@abc.com',
    companyId: 'company-1',
    roleId: 'role-1',
  };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    rolesService = { findOne: jest.fn() };

    guard = new PermissionsGuard(
      reflector as unknown as Reflector,
      rolesService as unknown as RolesService,
    );
  });

  it('allows the request when the route requires no permission', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(fakeContext())).resolves.toBe(true);
    expect(rolesService.findOne).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated request when a permission is required', async () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.PRODUCTS_READ]);

    await expect(guard.canActivate(fakeContext(undefined))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('allows the Owner role regardless of its stored permissions', async () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.ROLES_MANAGE]);
    rolesService.findOne.mockResolvedValue({
      isOwnerRole: true,
      permissions: [],
    } as unknown as Role);

    await expect(guard.canActivate(fakeContext(user))).resolves.toBe(true);
  });

  it('rejects a role missing one of the required permissions', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      Permission.PRODUCTS_READ,
      Permission.PRODUCTS_DELETE,
    ]);
    rolesService.findOne.mockResolvedValue({
      isOwnerRole: false,
      permissions: [Permission.PRODUCTS_READ],
    } as unknown as Role);

    await expect(guard.canActivate(fakeContext(user))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows a role holding every required permission', async () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.PRODUCTS_READ]);
    rolesService.findOne.mockResolvedValue({
      isOwnerRole: false,
      permissions: [Permission.PRODUCTS_READ, Permission.PRODUCTS_UPDATE],
    } as unknown as Role);

    await expect(guard.canActivate(fakeContext(user))).resolves.toBe(true);
  });
});
