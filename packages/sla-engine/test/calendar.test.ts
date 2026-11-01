import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BusinessCalendar} from '../src/calendar';

const H = 3600;
// A fixed Monday 2024-01-01 08:00 UTC reference for deterministic tests.
const MON_08 = Date.UTC(2024, 0, 1, 8, 0, 0); // 2024-01-01 is a Monday
const MON_09 = Date.UTC(2024, 0, 1, 9, 0, 0);
const MON_12 = Date.UTC(2024, 0, 1, 12, 0, 0);
const MON_17 = Date.UTC(2024, 0, 1, 17, 0, 0);

test('continuous calendar counts wall-clock seconds', () => {
  const cal = new BusinessCalendar({continuous: true});
  assert.equal(cal.businessSecondsBetween(0, 3600_000), 3600);
  assert.equal(cal.addBusinessSeconds(0, 3600), 3600_000);
});

test('default Mon-Fri 9-5: same-day elapsed clips to working window', () => {
  const cal = new BusinessCalendar();
  // 08:00 -> 12:00 counts only from 09:00 => 3h
  assert.equal(cal.businessSecondsBetween(MON_08, MON_12), 3 * H);
  // 09:00 -> 17:00 is a full working day => 8h
  assert.equal(cal.businessSecondsBetween(MON_09, MON_17), 8 * H);
});

test('spanning a weekend skips Sat/Sun', () => {
  const cal = new BusinessCalendar();
  const friday17 = Date.UTC(2024, 0, 5, 17, 0, 0); // Fri
  const monday9 = Date.UTC(2024, 0, 8, 9, 0, 0); // next Mon
  assert.equal(cal.businessSecondsBetween(friday17, monday9), 0);
  const monday12 = Date.UTC(2024, 0, 8, 12, 0, 0);
  assert.equal(cal.businessSecondsBetween(friday17, monday12), 3 * H);
});

test('addBusinessSeconds rolls to the next working day', () => {
  const cal = new BusinessCalendar();
  // From Mon 16:00, add 2h of work => Tue 10:00 (1h Mon + 1h Tue)
  const mon16 = Date.UTC(2024, 0, 1, 16, 0, 0);
  const due = cal.addBusinessSeconds(mon16, 2 * H);
  assert.equal(due, Date.UTC(2024, 0, 2, 10, 0, 0));
});

test('holidays are excluded', () => {
  const cal = new BusinessCalendar({holidays: ['2024-01-02']});
  // Mon 09:00 + 8h work = end of Mon; +1h more should skip Tue (holiday) to Wed 09:00..10:00
  const due = cal.addBusinessSeconds(MON_09, 9 * H);
  assert.equal(due, Date.UTC(2024, 0, 3, 10, 0, 0));
});

test('timezone offset shifts the working window', () => {
  // UTC+05:30. Local 09:00 == 03:30 UTC.
  const cal = new BusinessCalendar({timeZoneOffsetMinutes: 330});
  const localMon09Utc = Date.UTC(2024, 0, 1, 3, 30, 0);
  const localMon12Utc = Date.UTC(2024, 0, 1, 6, 30, 0);
  assert.equal(cal.businessSecondsBetween(localMon09Utc, localMon12Utc), 3 * H);
});

test('week-leaping matches day-stepping over long spans', () => {
  const cal = new BusinessCalendar();
  const start = MON_09;
  const end = Date.UTC(2024, 2, 1, 12, 0, 0); // two months later
  // 40h/week * number of weeks is non-trivial; compare against a naive loop.
  const naive = naiveBusinessSeconds(cal, start, end);
  assert.equal(cal.businessSecondsBetween(start, end), naive);
});

test('round-trip: elapsed to deadline is consistent', () => {
  const cal = new BusinessCalendar();
  const target = 5 * H;
  const due = cal.addBusinessSeconds(MON_09, target);
  assert.equal(cal.businessSecondsBetween(MON_09, due), target);
});

// Naive O(minutes) reference implementation for cross-checking.
function naiveBusinessSeconds(cal: BusinessCalendar, a: number, b: number): number {
  let secs = 0;
  const step = 60_000; // 1-minute granularity
  for (let t = a; t < b; t += step) {
    if (cal.isWorkingTime(t)) secs += 60;
  }
  return secs;
}
