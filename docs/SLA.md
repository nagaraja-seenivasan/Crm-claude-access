# SLA Tracking

SLA tracking is provided by two libraries. The application imports them and
does the database and AWS work itself.

| Piece | Location | Role |
|-------|----------|------|
| `@crm/sla-engine` | `packages/sla-engine/` | Business calendars, SLA clocks, incident triggers, EventBridge Scheduler adapter, report aggregation. Zero runtime dependencies. |
| `@crm/sla-ui` | `packages/sla-ui/` | Angular components: SLA setup, report builder, dashboard report, downloadable grid report (CSV). Plain Angular, no third-party UI kit. |
| MySQL schema | `database/mysql/` | Tables for SLA config, SLA details stored per incident, audit events, schedule outbox, reporting views. |

## Flow

```
Incident created/updated ──────────────┐
 (CRM API, or existing EventBridge     │
  rule → SQS)                          ▼
                              SlaTriggerProcessor.onIncidentChange()
SLA timer fires ─────────────▶SlaTriggerProcessor.onTimer()
 (EventBridge Scheduler → SQS)         │
                                       ▼
            SlaProcessResult { records, summary, scheduleActions, events }
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                              ▼                              ▼
 incident_sla +                  sla_event                   sla_schedule_outbox
 incident_sla_summary            (audit log)                          │
 (same transaction as                                                 ▼
  the incident write)                                    EventBridgeSlaScheduler
                                                         (one-time at() schedules)
```

1. **Incident create/update:** the application loads the incident's stored SLA
   records, calls `onIncidentChange()`, and saves the result in the same
   transaction as the incident. All SLA details (status, due time, breach
   time, elapsed time, budget used, holds, timers) are stored already
   computed, so reports and work queues read columns instead of recalculating.
2. **Triggers:** start, pause, resume, stop, cancel, reopen, restart and
   retarget, driven by conditions on incident fields. `incidentTriggerPreset()`
   covers the usual lifecycle.
3. **Timers:** warning, breach and escalation points become one-time
   EventBridge Scheduler schedules. They are written to the outbox first and
   applied by a dispatcher, so the database and AWS never disagree.
4. **Timer fires:** the scheduler sends the timer to SQS. The application calls
   `onTimer()` and saves the result. Timers made outdated by a later change
   are ignored, using a version number on each record.
5. **Reports:** the reporting views in `database/mysql/005_sla_reporting_views.sql`,
   or `buildReport()` over stored records, feed `<sla-dashboard>` and
   `<sla-grid-report>`.

## Database

Apply the scripts in order on MySQL 8.0+ (each is safe to re-run):

```bash
for f in database/mysql/0*.sql; do mysql -u <user> -p <database> < "$f"; done
```

| Table / view | Contents |
|--------------|----------|
| `sla_calendar`, `sla_policy`, `sla_trigger_config` | SLA configuration |
| `incident_sla` | One row per incident and policy: the stored SLA details |
| `incident_sla_summary` | Per-incident summary: next due time, worst status, breach flag |
| `sla_event` | Append-only audit log; duplicates ignored |
| `sla_schedule_outbox` | Pending EventBridge Scheduler actions |
| `v_sla_open`, `v_sla_attainment_daily`, `v_sla_breaches_daily` | Reporting views |

Times are stored as UTC `DATETIME(3)`. `database/mysql/900_sample_queries.sql`
has the statements the application runs.

## AWS

- **Existing EventBridge rule** for incident events → SQS, parsed with
  `parseIncidentEvent()`.
- **EventBridge Scheduler** schedule group (e.g. `crm-sla`) for SLA timers,
  targeting an SQS queue; parsed with `parseSlaTimerMessage()`.
- **Permissions:** the app needs `scheduler:CreateSchedule`, `UpdateSchedule`,
  `DeleteSchedule` and `iam:PassRole`. The scheduler's role needs
  `sqs:SendMessage` on the timer queue.
- **Optional:** publish SLA events to an EventBridge bus with
  `toEventBridgeEntries()` and `PutEvents`.

## Performance

Report aggregation measured about 1.2M SLA instances per second on one core
(4 vCPU Xeon 2.1 GHz container; one instance = one SLA on one incident). On an
EC2 t3.large, expect roughly 1–1.5M/s while it has CPU credits, or about
30% of that if credits run out in standard mode. Run `npm run bench` in
`packages/sla-engine` to measure on your hardware.

Full API, samples and guarantees:
[`packages/sla-engine/README.md`](../packages/sla-engine/README.md),
[`packages/sla-ui/README.md`](../packages/sla-ui/README.md),
[`database/mysql/README.md`](../database/mysql/README.md).
