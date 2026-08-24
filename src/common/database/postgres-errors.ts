import { QueryFailedError } from 'typeorm';

/**
 * Postgres SQLSTATE codes.
 *
 * These come from the SQL standard's error-code scheme, not from TypeORM, and
 * are stable across Postgres versions.
 *
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export const PostgresErrorCode = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  NOT_NULL_VIOLATION: '23502',
} as const;

/**
 * True when the error is the database refusing a duplicate row.
 *
 * Checking "does this already exist" before inserting can always lose a race:
 * two requests both pass the check, then one insert loses. The unique
 * constraint is the real guarantee, so services catch this and answer with the
 * same 409 the pre-check would have produced — instead of letting a raw
 * database error surface as a 500.
 *
 * @example
 * try {
 *   await repo.save(user);
 * } catch (error) {
 *   if (isUniqueViolation(error)) {
 *     throw new ConflictException('A user with this email already exists');
 *   }
 *   throw error;
 * }
 */
export function isUniqueViolation(error: unknown): boolean {
  return hasPostgresCode(error, PostgresErrorCode.UNIQUE_VIOLATION);
}

/**
 * True when the database refuses to delete a row another table still points at.
 *
 * This is a rejected request, not a bug: the row is in use and the user needs
 * to be told which. Left uncaught it reaches the client as an opaque 500,
 * because the global filter cannot know that a driver error was expected.
 *
 * @see removeEntity — the delete path that turns this into a 409.
 */
export function isForeignKeyViolation(error: unknown): boolean {
  return hasPostgresCode(error, PostgresErrorCode.FOREIGN_KEY_VIOLATION);
}

function hasPostgresCode(error: unknown, code: string): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  // TypeORM types driverError as `any`, so the shape is narrowed here rather
  // than at every call site.
  const driverError = error.driverError as { code?: string } | undefined;

  return driverError?.code === code;
}
