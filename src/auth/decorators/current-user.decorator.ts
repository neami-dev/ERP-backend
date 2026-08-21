import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { JwtPayload } from '../auth.service';

/**
 * Reads the authenticated user out of the request, where `AuthGuard` put it
 * after verifying the JWT.
 *
 * Use it to get the company of the caller — never trust a company id sent in
 * the request body, or a user could write into someone else's company.
 *
 * @example
 * findAll(@CurrentUser('companyId') companyId: string) { ... }
 * getMe(@CurrentUser() user: JwtPayload) { ... }
 */
export const CurrentUser = createParamDecorator(
  (field: keyof JwtPayload | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;

    return field ? user?.[field] : user;
  },
);
