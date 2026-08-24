import { Transform } from 'class-transformer';

/**
 * Trims a string and collapses internal whitespace.
 *
 * People paste identifiers with the spacing they were given —
 * `001 234 567 000 025` for an ICE. Without this every strict format
 * validator below fails on formatting, not on the value.
 */
export function TrimAndCompact() {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, '') : value,
  );
}

/**
 * Uppercases a string.
 *
 * `IsISO4217CurrencyCode`-style checks compare against uppercase codes, so
 * `"mad"` fails a check that `"MAD"` passes for no reason a user would
 * understand.
 */
export function UpperCase() {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  );
}

/**
 * Turns an empty string into `null`.
 *
 * A form clearing a field sends `""`, which then fails `@Matches` with a
 * confusing message. `@IsOptional()` already accepts `null`, so this makes
 * "clear the field" and "field was never set" both send a value the DTO is
 * happy with — while an omitted key still means "leave it alone".
 */
export function EmptyToNull() {
  return Transform(({ value }: { value: unknown }) =>
    value === '' ? null : value,
  );
}
