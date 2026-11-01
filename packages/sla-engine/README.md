# @crm/sla-engine

A high-performance, **dependency-free** SLA (Service Level Agreement) engine for
Node.js and the browser, with a **report-optimized** streaming aggregation layer.

- **Fast** — hot paths are pure integer/`Math.floor` arithmetic; no `Date`
  allocation inside loops; business-time spans advance a week at a time
  ("week-leaping", O(weeks) not O(days)).
- **Report-level optimized** — reports are built in a **single streaming pass**
  with **O(1) memory per group** and streaming percentiles (P² algorithm), so
  P50/P90/P95/P99 over millions of records never require sorting or buffering.
  Measured ~**1,000,000 SLA instances aggregated per second** on a single core
  (see `npm run bench`).
- **Correct** — pause/resume (holds), business calendars, holidays, timezone
  offsets, and target rules by priority.
- **Zero runtime dependencies.**

## Install

```bash
npm install @crm/sla-engine
```

## Quick start

```ts
import {SlaEngine} from '@crm/sla-engine';

const engine = new SlaEngine();

// 1. Define a business calendar (default is Mon–Fri 09:00–17:00).
engine.addCalendar('india-biz', {
  timeZoneOffsetMinutes: 330,            // UTC+05:30
  week: {1: [{start: 540, end: 1080}], 2: [{start: 540, end: 1080}],
         3: [{start: 540, end: 1080}], 4: [{start: 540, end: 1080}],
         5: [{start: 540, end: 1080}]},  // Mon–Fri 09:00–18:00
  holidays: ['2026-01-26', '2026-08-15'],
});

// 2. Define a policy with priority-based targets.
engine.addPolicy({
  id: 'resolution',
  metric: 'resolution',
  calendarId: 'india-biz',
  defaultTargetSeconds: 8 * 3600,                       // 8 business hours
  rules: [
    {when: {priority: 'high'}, targetSeconds: 4 * 3600, priority: 10},
    {when: {priority: 'urgent'}, targetSeconds: 1 * 3600, priority: 20},
  ],
});

// 3. Start tracking an entity (e.g. a CRM ticket).
const ticket = engine.startInstance({
  id: 'TKT-1001',
  policyId: 'resolution',
  startedAt: '2026-11-01T09:15:00Z',
  dimensions: {priority: 'high', team: 'support-apac', channel: 'email'},
});

// 4. Evaluate it at any moment.
const status = engine.evaluate(ticket, Date.now());
console.log(status.status, status.remainingSeconds, status.dueAt);
```

## Holds (pause / resume)

Add `holds` to an instance to stop the clock (e.g. "waiting on customer").
Business time inside a hold is excluded from the elapsed clock *and* pushes the
deadline out, so holds never cause a false breach.

```ts
const inst = {
  ...ticket,
  holds: [{from: Date.parse('2026-11-01T11:00:00Z'),
           to:   Date.parse('2026-11-01T14:00:00Z'),
           reason: 'awaiting-customer'}],
};
engine.evaluate(inst, Date.now());
```

## Reporting

A single `ReportDefinition` powers both a dashboard summary and a grid export.
Reports stream straight from any iterable — array, generator, or a DB-cursor
adapter — so you never need the whole dataset in memory.

```ts
const report = engine.report(
  {
    id: 'breach-by-team',
    groupBy: ['team', 'priority'],
    measure: 'elapsedSeconds',
    quantiles: [0.5, 0.9, 0.95],
    filters: [{field: 'channel', op: 'eq', value: 'email'}],
    sortBy: 'breachRate',
    sortDir: 'desc',
    limit: 50,
  },
  instancesIterable,          // Iterable<SlaInstance>
  Date.now(),
);

report.summary;  // { count, breached, met, open, avg, breachRate, attainment, quantiles: {p50,p90,p95} }
report.rows;     // one row per (team, priority) group with the same stats shape
```

### Trend reports (time buckets)

```ts
engine.report(
  {id: 'daily-breaches', bucket: {field: 'breachedAt', widthMs: 86_400_000}},
  instances,
);
// each row's key.__bucket is the start-of-day epoch
```

## API surface

| Export | Purpose |
| --- | --- |
| `SlaEngine` | Façade: register calendars/policies, evaluate, report. |
| `BusinessCalendar` | Business-time maths (`businessSecondsBetween`, `addBusinessSeconds`, `isWorkingTime`, `nextWorkingInstant`). |
| `SlaPolicy` | Target resolution by priority rules. |
| `evaluateInstance` / `evaluateAt` | Evaluate one instance directly. |
| `buildReport` | Streaming aggregation over `Iterable<SlaEvaluation>`. |
| `P2Quantile` | Standalone streaming quantile estimator. |

## Design notes & trade-offs

- **Fixed timezone offset, not full IANA/DST.** The hot path uses a constant
  UTC offset for speed. For DST-sensitive SLAs, pre-normalise inputs or split
  policies by season. This is an intentional performance trade-off.
- **Approximate percentiles.** P² is an estimator (O(1) memory); accuracy is
  excellent for the smooth, heavy-tailed distributions typical of SLA metrics
  and improves with sample size. Use exact sorting only if you must.

## Scripts

```bash
npm run build   # tsc -> dist/
npm test        # node:test (21 tests, zero test deps)
npm run bench   # throughput smoke test (~1M instances/s)
```

## License

MIT
