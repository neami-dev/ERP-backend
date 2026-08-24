import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 10;

/**
 * Hashing is slow on purpose (~100ms). Shared by every place a password is
 * first set — signup and direct user creation — so the cost factor lives in
 * one place.
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, BCRYPT_ROUNDS);
}
