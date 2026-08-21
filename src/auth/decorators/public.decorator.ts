import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as reachable without a JWT.
 *
 * The `AuthGuard` is registered globally, so every route needs a token unless
 * it carries this decorator.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
