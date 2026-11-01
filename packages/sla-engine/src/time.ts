import type {EpochMs, TimeInput} from './types';

/** Milliseconds in one day. */
export const DAY_MS = 86_400_000;
/** Milliseconds in one minute. */
export const MINUTE_MS = 60_000;
/** Minutes in one day. */
export const DAY_MINUTES = 1440;

/**
 * Normalise any {@link TimeInput} to epoch milliseconds.
 *
 * Numbers are returned as-is (the hot-path case — zero allocation). `Date` and
 * ISO strings are parsed. Throws on invalid input so bad data fails loudly
 * rather than silently producing `NaN` deadlines.
 */
export function toEpochMs(value: TimeInput): EpochMs {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new RangeError(`Invalid epoch: ${value}`);
    return value;
  }
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(ms)) throw new RangeError(`Invalid time input: ${String(value)}`);
  return ms;
}

/**
 * The "epoch day" index (days since 1970-01-01) for a local millisecond value.
 * Uses `Math.floor` so negative (pre-epoch) values are handled correctly.
 */
export function epochDay(localMs: number): number {
  return Math.floor(localMs / DAY_MS);
}

/**
 * Weekday for an epoch-day index. 1970-01-01 (day 0) was a Thursday, so
 * `0 = Sunday … 6 = Saturday`.
 */
export function weekdayOf(day: number): number {
  const w = (day + 4) % 7;
  return w < 0 ? w + 7 : w;
}

/** Convert a `YYYY-MM-DD` local date string to an epoch-day index. */
export function dayFromISODate(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) throw new RangeError(`Expected YYYY-MM-DD, got: ${iso}`);
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Math.floor(utc / DAY_MS);
}
