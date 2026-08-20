/**
 * Today as a calendar date, `YYYY-MM-DD`.
 *
 * `new Date().toISOString().slice(0, 10)` would give the date in **UTC**, so
 * for anyone east or west of UTC it can be the wrong day for part of every
 * day. This uses the server's local calendar instead, which is what "the day
 * the order was placed" means to the person placing it.
 */
export function today(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
