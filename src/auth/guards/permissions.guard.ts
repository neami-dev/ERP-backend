import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { JwtPayload } from '../auth.service';
import { RolesService } from 'src/roles/roles.service';
import { Permission } from 'src/common/permissions/permission';

/**
 * Runs after `AuthGuard`, which has already verified the JWT and attached its
 * payload to `request.user`. This guard only decides whether that user's
 * role covers what the route requires.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rolesService: RolesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request['user'] as JwtPayload | undefined;

    if (!user) {
      throw new UnauthorizedException();
    }

    const role = await this.rolesService.findOne(user.roleId, user.companyId);

    if (role.isOwnerRole) {
      return true;
    }

    const hasAllPermissions = required.every((permission) =>
      role.permissions.includes(permission),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException('You do not have permission to do this');
    }

    return true;
  }
}
