/**
 * Rounds a money amount to two decimals.
 *
 * `0.1 + 0.2` is `0.30000000000000004` in floating point, and a total built
 * from a few of those reaches the client with a tail of digits no invoice ever
 * had. Every computed amount goes through here, so what is shown matches what
 * the columns hold — they are `numeric(10, 2)`.
 */
export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}
