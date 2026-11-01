import {
  DAY_MINUTES,
  DAY_MS,
  MINUTE_MS,
  dayFromISODate,
  epochDay,
  toEpochMs,
  weekdayOf,
} from './time';
import type {
  BusinessCalendarConfig,
  EpochMs,
  TimeInput,
  Weekday,
  WorkingInterval,
} from './types';

/** Mon–Fri, 09:00–17:00. */
const DEFAULT_WEEK: WorkingInterval[][] = [
  [], // Sun
  [{start: 540, end: 1020}], // Mon
  [{start: 540, end: 1020}], // Tue
  [{start: 540, end: 1020}], // Wed
  [{start: 540, end: 1020}], // Thu
  [{start: 540, end: 1020}], // Fri
  [], // Sat
];

/**
 * A business calendar that converts between wall-clock instants and
 * *business time* (time that counts against an SLA budget).
 *
 * ## Performance
 *
 * All per-day data is precomputed once at construction:
 *  - `dayWorkMinutes[weekday]` — total working minutes, so a full day costs an
 *    O(1) lookup instead of re-summing intervals.
 *  - `secondsPerWeek` — enables *week leaping*: spans with no holidays advance
 *    seven days at a time, making long spans O(weeks) rather than O(days).
 *
 * The hot paths ({@link businessSecondsBetween}, {@link addBusinessSeconds})
 * operate purely on integers/`Math.floor`, never allocating `Date` objects.
 */
export class BusinessCalendar {
  readonly id: string;
  readonly continuous: boolean;
  private readonly offsetMs: number;
  private readonly week: WorkingInterval[][];
  private readonly dayWorkSeconds: number[];
  private readonly secondsPerWeek: number;
  private readonly holidays: Set<number>;

  constructor(config: BusinessCalendarConfig & {id?: string} = {}) {
    this.id = config.id ?? 'default';
    this.continuous = config.continuous === true;
    this.offsetMs = (config.timeZoneOffsetMinutes ?? 0) * MINUTE_MS;

    // Normalise the weekly schedule into a dense 7-slot array with sorted,
    // validated, non-overlapping intervals.
    this.week = new Array(7);
    for (let d = 0 as Weekday; d < 7; d++) {
      const raw = config.week?.[d as Weekday] ?? (config.week ? [] : DEFAULT_WEEK[d]);
      this.week[d] = normaliseIntervals(raw, d);
    }

    this.dayWorkSeconds = this.week.map(
      intervals => intervals.reduce((s, iv) => s + (iv.end - iv.start) * 60, 0),
    );
    this.secondsPerWeek = this.dayWorkSeconds.reduce((a, b) => a + b, 0);

    this.holidays = new Set();
    for (const h of config.holidays ?? []) {
      this.holidays.add(typeof h === 'number' ? h : dayFromISODate(h));
    }
  }

  /** Local-civil milliseconds for a UTC instant. */
  private local(utcMs: number): number {
    return utcMs + this.offsetMs;
  }

  /** UTC instant for a local-civil millisecond value. */
  private utc(localMs: number): EpochMs {
    return localMs - this.offsetMs;
  }

  private isHoliday(day: number): boolean {
    return this.holidays.size > 0 && this.holidays.has(day);
  }

  /** Working seconds available in a single local day. */
  private daySeconds(day: number): number {
    if (this.isHoliday(day)) return 0;
    return this.dayWorkSeconds[weekdayOf(day)];
  }

  /**
   * Working seconds in `day` between `fromMin` and `toMin` (minutes from local
   * midnight, `fromMin <= toMin`). O(number of intervals in the weekday).
   */
  private daySecondsBetween(day: number, fromMin: number, toMin: number): number {
    if (toMin <= fromMin || this.isHoliday(day)) return 0;
    const intervals = this.week[weekdayOf(day)];
    let secs = 0;
    for (let i = 0; i < intervals.length; i++) {
      const lo = intervals[i].start > fromMin ? intervals[i].start : fromMin;
      const hi = intervals[i].end < toMin ? intervals[i].end : toMin;
      if (hi > lo) secs += (hi - lo) * 60;
    }
    return secs;
  }

  /** Whether no configured holiday falls in the inclusive day range. */
  private holidayFreeRange(fromDay: number, toDay: number): boolean {
    if (this.holidays.size === 0) return true;
    // Iterating the (usually small) holiday set beats scanning the day range.
    for (const h of this.holidays) if (h >= fromDay && h <= toDay) return false;
    return true;
  }

  /**
   * Business seconds between two instants. Negative input order is handled:
   * the result is always `>= 0` and symmetric in magnitude.
   */
  businessSecondsBetween(a: TimeInput, b: TimeInput): number {
    let t0 = toEpochMs(a);
    let t1 = toEpochMs(b);
    if (t1 < t0) {
      const tmp = t0;
      t0 = t1;
      t1 = tmp;
    }
    if (this.continuous) return (t1 - t0) / 1000;
    if (this.secondsPerWeek === 0) return 0;

    const l0 = this.local(t0);
    const l1 = this.local(t1);
    const d0 = epochDay(l0);
    const d1 = epochDay(l1);
    const m0 = (l0 - d0 * DAY_MS) / MINUTE_MS;
    const m1 = (l1 - d1 * DAY_MS) / MINUTE_MS;

    if (d0 === d1) return this.daySecondsBetween(d0, m0, m1);

    let total = this.daySecondsBetween(d0, m0, DAY_MINUTES);
    // Whole days strictly between d0 and d1.
    let d = d0 + 1;
    const lastWhole = d1 - 1;
    while (d <= lastWhole) {
      if (d + 6 <= lastWhole && this.holidayFreeRange(d, d + 6)) {
        total += this.secondsPerWeek;
        d += 7;
      } else {
        total += this.daySeconds(d);
        d += 1;
      }
    }
    total += this.daySecondsBetween(d1, 0, m1);
    return total;
  }

  /**
   * The instant reached by consuming `seconds` of *business time* starting at
   * `start`. With `seconds = 0` this returns `start` unchanged. Negative values
   * are clamped to 0.
   */
  addBusinessSeconds(start: TimeInput, seconds: number): EpochMs {
    const t0 = toEpochMs(start);
    if (this.continuous) return t0 + Math.max(0, seconds) * 1000;
    if (seconds <= 0 || this.secondsPerWeek === 0) return t0;

    let remaining = seconds;
    const l0 = this.local(t0);
    let day = epochDay(l0);
    let minute = (l0 - day * DAY_MS) / MINUTE_MS;

    // Guard against unbounded loops if the calendar has working time but the
    // target is absurdly large relative to it.
    const maxDays = Math.ceil((seconds / this.secondsPerWeek) * 7) + 14;
    for (let step = 0; step <= maxDays; step++) {
      const avail = this.daySecondsBetween(day, minute, DAY_MINUTES);
      if (remaining <= avail) {
        const localTarget = this.resolveWithinDay(day, minute, remaining);
        return this.utc(localTarget);
      }
      remaining -= avail;
      day += 1;
      minute = 0;
      // Leap a full holiday-free week once we are day-aligned.
      while (remaining > this.secondsPerWeek && this.holidayFreeRange(day, day + 6)) {
        remaining -= this.secondsPerWeek;
        day += 7;
      }
    }
    // Should be unreachable for sane inputs; return end of the scanned horizon.
    return this.utc(day * DAY_MS);
  }

  /**
   * Local-ms instant inside `day`, starting at `fromMin`, after `need` working
   * seconds. Caller guarantees `need <= available in the day`.
   */
  private resolveWithinDay(day: number, fromMin: number, need: number): number {
    if (need <= 0) return day * DAY_MS + fromMin * MINUTE_MS;
    const intervals = this.week[weekdayOf(day)];
    let remaining = need;
    for (let i = 0; i < intervals.length; i++) {
      const lo = intervals[i].start > fromMin ? intervals[i].start : fromMin;
      const hi = intervals[i].end;
      if (hi <= lo) continue;
      const segSeconds = (hi - lo) * 60;
      if (remaining <= segSeconds) {
        return day * DAY_MS + lo * MINUTE_MS + remaining * 1000;
      }
      remaining -= segSeconds;
    }
    // Exhausted the day exactly; land on its final working minute.
    const last = intervals[intervals.length - 1];
    return day * DAY_MS + last.end * MINUTE_MS;
  }

  /** Whether `t` falls inside a working window. */
  isWorkingTime(t: TimeInput): boolean {
    if (this.continuous) return true;
    const l = this.local(toEpochMs(t));
    const day = epochDay(l);
    if (this.isHoliday(day)) return false;
    const minute = (l - day * DAY_MS) / MINUTE_MS;
    const intervals = this.week[weekdayOf(day)];
    for (let i = 0; i < intervals.length; i++) {
      if (minute >= intervals[i].start && minute < intervals[i].end) return true;
    }
    return false;
  }

  /** The next instant `>= t` that is working time (or `t` itself). */
  nextWorkingInstant(t: TimeInput): EpochMs {
    const t0 = toEpochMs(t);
    if (this.continuous || this.isWorkingTime(t0)) return t0;
    // Equivalent to "add zero business seconds from the next working boundary":
    // consume an epsilon of business time and subtract it back out.
    const eps = this.addBusinessSeconds(t0, 1);
    return this.businessSecondsBetween(t0, eps) === 0 ? eps : this.addBusinessSeconds(t0, 0.000001);
  }
}

function normaliseIntervals(raw: WorkingInterval[], weekday: number): WorkingInterval[] {
  const sorted = raw
    .map(iv => ({start: iv.start, end: iv.end}))
    .filter(iv => iv.end > iv.start)
    .sort((a, b) => a.start - b.start);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].start < 0 || sorted[i].end > DAY_MINUTES) {
      throw new RangeError(`Interval out of range on weekday ${weekday}: ${JSON.stringify(sorted[i])}`);
    }
    if (i > 0 && sorted[i].start < sorted[i - 1].end) {
      throw new RangeError(`Overlapping intervals on weekday ${weekday}`);
    }
  }
  return sorted;
}
