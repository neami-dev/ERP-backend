import { ConflictException } from '@nestjs/common';
import { ObjectLiteral, Repository } from 'typeorm';

import { isForeignKeyViolation } from './postgres-errors';

/**
 * Deletes a row and answers with it, id included.
 *
 * Every delete in this codebase has the same two things to get right, so they
 * live here once instead of in each service:
 *
 * 1. TypeORM's `remove()` strips the primary key off the entity it returns, so
 *    the client would get the deleted row back minus the one field it needs to
 *    drop it from a list. The id is put back.
 * 2. Postgres refuses to delete a row that another table still references. That
 *    is the database protecting history — a purchase order pointing at the
 *    supplier, stock movements pointing at the product — and the user needs to
 *    be told which. Uncaught it surfaces as a bare 500.
 *
 * @param inUseMessage Why the row cannot go, in words a user can act on.
 */
export async function removeEntity<T extends ObjectLiteral & { id: string }>(
  repository: Repository<T>,
  entity: T,
  inUseMessage: string,
): Promise<T> {
  // Read before the delete: `remove()` mutates the entity it is given.
  const { id } = entity;

  try {
    const removed = await repository.remove(entity);

    return { ...removed, id };
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw new ConflictException(inUseMessage);
    }

    throw error;
  }
}
