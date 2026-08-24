import { SetMetadata } from '@nestjs/common';

import { Permission } from 'src/common/permissions/permission';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Marks a route as requiring one or more permissions.
 *
 * `PermissionsGuard` is registered globally, so a route with no permissions
 * listed is reachable by any authenticated user (e.g. `GET /auth/profile`).
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
