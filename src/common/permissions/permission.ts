/**
 * Every action in the app that a role can be granted or denied.
 *
 * A plain const catalog rather than a database table: it needs to be
 * type-checked at the call site of `@RequirePermissions(...)`, and the
 * frontend only needs the list of strings to render a checkbox per role
 * (see `GET /roles/permissions`).
 */
export const Permission = {
  PRODUCTS_CREATE: 'products:create',
  PRODUCTS_READ: 'products:read',
  PRODUCTS_UPDATE: 'products:update',
  PRODUCTS_DELETE: 'products:delete',

  CATEGORIES_CREATE: 'categories:create',
  CATEGORIES_READ: 'categories:read',
  CATEGORIES_UPDATE: 'categories:update',
  CATEGORIES_DELETE: 'categories:delete',

  SUPPLIERS_CREATE: 'suppliers:create',
  SUPPLIERS_READ: 'suppliers:read',
  SUPPLIERS_UPDATE: 'suppliers:update',
  SUPPLIERS_DELETE: 'suppliers:delete',

  WAREHOUSES_CREATE: 'warehouses:create',
  WAREHOUSES_READ: 'warehouses:read',
  WAREHOUSES_UPDATE: 'warehouses:update',
  WAREHOUSES_DELETE: 'warehouses:delete',

  CUSTOMERS_CREATE: 'customers:create',
  CUSTOMERS_READ: 'customers:read',
  CUSTOMERS_UPDATE: 'customers:update',
  CUSTOMERS_DELETE: 'customers:delete',

  INVENTORIES_READ: 'inventories:read',
  INVENTORIES_DELETE: 'inventories:delete',

  STOCK_MOVEMENTS_CREATE: 'stock-movements:create',
  STOCK_MOVEMENTS_READ: 'stock-movements:read',

  PURCHASES_CREATE: 'purchases:create',
  PURCHASES_READ: 'purchases:read',
  PURCHASES_UPDATE: 'purchases:update',
  PURCHASES_DELETE: 'purchases:delete',
  PURCHASES_CONFIRM: 'purchases:confirm',
  PURCHASES_CANCEL: 'purchases:cancel',
  PURCHASES_RECEIVE: 'purchases:receive',

  COMPANIES_READ: 'companies:read',
  COMPANIES_UPDATE: 'companies:update',

  USERS_READ: 'users:read',
  USERS_MANAGE: 'users:manage',

  ROLES_MANAGE: 'roles:manage',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

export const ALL_PERMISSIONS: Permission[] = Object.values(Permission);
