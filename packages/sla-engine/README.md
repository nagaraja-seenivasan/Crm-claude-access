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
- **Incident triggers + AWS EventBridge** — pre-computed SLA details to store
  with each incident, plus one-time EventBridge Scheduler timers for warning and
  breach (see below).
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

## Incident triggers + AWS EventBridge

The trigger layer turns **incident create/update events** and **fired timers**
into everything your application needs to store and do. It is pure (no I/O), so
**your application does the work**: it saves the result with the incident and
applies the schedule actions.

```
incident create/update ──▶ processor.onIncidentChange() ─┐
EventBridge Scheduler timer ─▶ processor.onTimer() ──────┤
                                                         ▼
                 SlaProcessResult { records, summary, scheduleActions, events }
                    │ save with the incident   │ apply via EventBridgeSlaScheduler
                    ▼ (same transaction)       ▼ (ideally through an outbox)
```

| Result field | What the app does with it |
| --- | --- |
| `records` | Save with the incident (one per policy). All SLA details are pre-computed: `status`, `dueAt`, `breachedAt`, `elapsedSeconds`, `consumedRatio`, holds, timers, `version`. |
| `summary` | Save as indexed columns: `nextDueAt`, `worstStatus`, `breached`, `openCount`. |
| `scheduleActions` | `upsert` / `delete` one-time schedules (warning, breach, escalations). |
| `events` | Append to an audit table and/or publish (`started`, `paused`, `resumed`, `stopped`, `met`, `breached`, `timer`, …). |

### Lifecycle triggers

| Action | Effect |
| --- | --- |
| `start` | Create the SLA record (no-op if one exists). |
| `pause` / `resume` | Open / close a hold. The clock stops, the deadline moves out, and the schedules are deleted, then recreated. |
| `stop` | Complete the SLA: `met`, or `breached` if late. |
| `cancel` | Cancel the SLA (excluded from attainment). |
| `reopen` | Un-complete it. The time it spent closed doesn't count. |
| `restart` | Throw the clock away and start again. |
| `retarget` | Re-resolve the target from the policy rules (e.g. priority changed). |

Conditions: `eq` `ne` `in` `nin` `gt` `gte` `lt` `lte` `exists` `missing`
`changed` `changed_to` `changed_from`, on dotted paths (`owner.team`). `when` is
AND, `any` is OR, and `on` limits a trigger to `create` or `update`.

Timers fire at a fraction of the budget (`{kind: 'warning', atRatio: 0.75}`,
`{kind: 'breach', atRatio: 1}`, `{kind: 'escalate', atRatio: 1.5}`). Holds and
business hours are taken into account.

### Setup

```ts
import {SlaEngine, SlaTriggerProcessor, incidentTriggerPreset} from '@crm/sla-engine';

const engine = new SlaEngine()
  .addCalendar('biz', {timeZoneOffsetMinutes: 330})
  .addPolicy({
    id: 'resolution', metric: 'resolution', calendarId: 'biz',
    defaultTargetSeconds: 8 * 3600,
    rules: [{when: {priority: 'P1'}, targetSeconds: 4 * 3600, priority: 10}],
  })
  .addPolicy({id: 'first-response', metric: 'first_response', calendarId: 'biz', defaultTargetSeconds: 3600});

const processor = new SlaTriggerProcessor(engine, [
  // Typical lifecycle: start on create, pause while waiting on the customer,
  // retarget on priority change, stop on resolve/close, reopen, cancel.
  incidentTriggerPreset({
    policyId: 'resolution',
    pauseStatuses: ['pending_customer', 'pending_vendor'],
    stopStatuses: ['resolved', 'closed'],
    dimensions: ['priority', 'team'],
  }),
  // Or write triggers yourself:
  {
    policyId: 'first-response',
    triggers: [
      {action: 'start', on: ['create']},
      {action: 'stop', when: [{field: 'firstRespondedAt', op: 'exists'}]},
    ],
    timers: [{kind: 'breach', atRatio: 1}],
    dimensions: {priority: 'priority', team: 'assignment.team'},
  },
]);
```

### Sample: app-side wiring (MySQL + EventBridge)

Tables are in [`database/mysql`](../../database/mysql). Below, `db` is a
`mysql2/promise` pool. The `save*` helpers are short and run the statements from
`database/mysql/900_sample_queries.sql`.

```ts
import {SchedulerClient, CreateScheduleCommand, UpdateScheduleCommand, DeleteScheduleCommand}
  from '@aws-sdk/client-scheduler';
import {EventBridgeClient, PutEventsCommand} from '@aws-sdk/client-eventbridge';
import {
  EventBridgeSlaScheduler, parseIncidentEvent, parseSlaTimerMessage, toEventBridgeEntries,
  type SlaProcessResult, type StoredSlaRecord,
} from '@crm/sla-engine';

const scheduler = new EventBridgeSlaScheduler({
  client: new SchedulerClient({}),
  commands: {CreateScheduleCommand, UpdateScheduleCommand, DeleteScheduleCommand},
  groupName: 'crm-sla',
  targetArn: process.env.SLA_TIMER_QUEUE_ARN!,      // SQS queue (or Lambda) receiving timers
  roleArn: process.env.SLA_SCHEDULER_ROLE_ARN!,     // role allowed to sqs:SendMessage
  deadLetterArn: process.env.SLA_TIMER_DLQ_ARN,
});

// 1) Incident create / update: store SLA details WITH the incident.
export async function saveIncident(current: Incident, previous?: Incident) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const records = await loadRecords(conn, current.id);            // SELECT ... FOR UPDATE
    const result = processor.onIncidentChange({current, previous, records});
    await upsertIncident(conn, current);                            // your table
    await saveSlaResult(conn, result);                              // incident_sla, summary, events, outbox
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// 2) Messages from SQS. The queue gets:
//    - incident events from your EXISTING EventBridge rule ("Incident Created/Updated")
//    - SLA timers from EventBridge Scheduler
export async function onSqsMessage(body: string) {
  const timer = parseSlaTimerMessage(body);
  if (timer) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const records = await loadRecords(conn, timer.incidentId);
      const result = processor.onTimer({payload: timer, records});
      if (!result.stale) await saveSlaResult(conn, result);        // breached/warned + events
      await conn.commit();
    } finally {
      conn.release();
    }
    return;
  }

  const incident = parseIncidentEvent(body, {
    createdTypes: ['Incident Created'],
    updatedTypes: ['Incident Updated'],
    currentPath: 'incident',            // detail.incident
    previousPath: 'previous',           // detail.previous
  });
  if (incident) await saveIncident(incident.current as Incident, incident.previous as Incident);
}

// 3) Outbox dispatcher: apply schedule actions to EventBridge Scheduler.
export async function dispatchOutbox() {
  const rows = await claimPendingOutbox(db, 50);                    // FOR UPDATE SKIP LOCKED
  const results = await scheduler.apply(rows.map(r => r.action));
  await markOutbox(db, rows, results);                              // done / retry with backoff
}

// 4) Optional: publish SLA events to your EventBridge bus for other consumers.
export async function publish(result: SlaProcessResult) {
  const eb = new EventBridgeClient({});
  for (const Entries of toEventBridgeEntries(result.events, {source: 'crm.sla', eventBusName: 'crm'})) {
    await eb.send(new PutEventsCommand({Entries}));
  }
}

async function saveSlaResult(conn: Conn, r: SlaProcessResult) {
  for (const rec of r.records) await upsertIncidentSla(conn, rec);  // record_json = JSON.stringify(rec)
  await upsertSummary(conn, r.incidentId, r.summary);
  for (const e of r.events) await insertEventIgnore(conn, e);
  for (const a of r.scheduleActions) await insertOutbox(conn, r.incidentId, a);
}

async function loadRecords(conn: Conn, incidentId: string): Promise<StoredSlaRecord[]> {
  const [rows] = await conn.query(
    'SELECT record_json FROM incident_sla WHERE incident_id = ? FOR UPDATE', [incidentId]);
  return (rows as Array<{record_json: StoredSlaRecord}>).map(r => r.record_json);
}
```

Reports can be built from the stored records, with no recomputation:

```ts
import {buildReport, recordToEvaluation} from '@crm/sla-engine';
const report = buildReport({id: 'by-team', groupBy: ['team']}, storedRecords.map(recordToEvaluation));
```

### Guarantees

- **Stale timers are ignored.** Every lifecycle change increments `version`,
  and each schedule payload carries the version it was created for. If an
  outdated timer fires, `onTimer` returns `stale: true` and changes nothing.
- **Missed timers catch up.** If an update arrives after a timer's moment (for
  example, the timer was lost), it fires inline and no schedule is created.
- **Retries are safe.** Schedule names are deterministic
  (`sla-{incident}-{policy}-{kind}`, AWS-safe, at most 64 chars). Upsert is
  create-or-update, delete ignores "not found", and the `sla_event` unique key
  drops duplicate events.
- **Breach timing.** An open SLA becomes `breached` the moment its deadline
  arrives. Completing exactly on the deadline counts as `met`.

### AWS setup

- **Schedule group:** `aws scheduler create-schedule-group --name crm-sla`
- **Scheduler role** (trusted by `scheduler.amazonaws.com`): `sqs:SendMessage`
  on the timer queue (or `lambda:InvokeFunction`).
- **App permissions:** `scheduler:CreateSchedule`, `scheduler:UpdateSchedule`,
  `scheduler:DeleteSchedule` on `arn:aws:scheduler:*:*:schedule/crm-sla/*`, and
  `iam:PassRole` on the scheduler role. Add `events:PutEvents` if you publish
  SLA events.
- **Existing EventBridge rule:** target the same SQS queue (or a separate one)
  with an event pattern on your incident `source` / `detail-type`.

`InMemorySlaScheduler` is provided for tests and local development
(`scheduler.due(now)` returns the payloads that are due).

## API surface

| Export | Purpose |
| --- | --- |
| `SlaEngine` | Façade: register calendars/policies, evaluate, report. |
| `BusinessCalendar` | Business-time maths (`businessSecondsBetween`, `addBusinessSeconds`, `isWorkingTime`, `nextWorkingInstant`). |
| `SlaPolicy` | Target resolution by priority rules. |
| `evaluateInstance` / `evaluateAt` | Evaluate one instance directly. |
| `buildReport` | Streaming aggregation over `Iterable<SlaEvaluation>`. |
| `P2Quantile` | Standalone streaming quantile estimator. |
| `SlaTriggerProcessor` | Incident change / timer → records, summary, schedule actions, events. |
| `incidentTriggerPreset` | Standard incident lifecycle trigger set. |
| `EventBridgeSlaScheduler` | Applies schedule actions as one-time EventBridge Scheduler schedules. |
| `parseIncidentEvent` / `parseSlaTimerMessage` | Parse EventBridge / SQS deliveries. |
| `toEventBridgeEntries` | SLA events → `PutEvents` batches. |
| `recordToEvaluation`, `summarize` | Report directly from stored records. |

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
npm test        # node:test (34 tests, zero test deps)
npm run bench   # throughput smoke test (~1M instances/s)
```

## License

MIT
