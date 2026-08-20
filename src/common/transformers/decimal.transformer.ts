import { ValueTransformer } from 'typeorm';

/**
 * Postgres `numeric`/`decimal` values arrive in JavaScript as **strings**,
 * because they can hold more precision than a JS number. Without this, a
 * price typed as `number` is really `"999.99"` at runtime, and the frontend
 * silently gets a string — `total + price` then concatenates instead of adding.
 *
 * This turns the column into a real number on the way out, and leaves the
 * value untouched on the way in.
 *
 * Note: this is safe for money in a normal ERP range. Values beyond
 * `Number.MAX_SAFE_INTEGER` would lose precision — use a decimal library if
 * that ever becomes a real case.
 */
export const decimalTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};
