# MySQL scripts

Tables for the rule builder backend and for storing the output of
`@crm/sla-engine`'s trigger processor alongside incidents. MySQL **8.0+** (uses JSON, generated columns, `SKIP LOCKED`).
All `DATETIME(3)` values are **UTC**. The library uses epoch milliseconds, so
convert with `FROM_UNIXTIME(ms / 1000)` or `new Date(ms)` and a driver set to
`timezone: 'Z'`.

| Script | Creates | Written from |
| --- | --- | --- |
| `000_rule_builder.sql` | `rule`, `rule_execution_log` | backend models `Rule`, `RuleExecutionLog` |
| `001_sla_config.sql` | `sla_calendar`, `sla_policy`, `sla_trigger_config` | your admin UI / seed data |
| `002_incident_sla.sql` | `incident_sla` (one row per incident + policy), `incident_sla_summary` | `result.records`, `result.summary` |
| `003_sla_event.sql` | `sla_event` (append-only audit, idempotent unique key) | `result.events` |
| `004_sla_schedule_outbox.sql` | `sla_schedule_outbox` (transactional outbox) | `result.scheduleActions` |
| `005_sla_reporting_views.sql` | `v_sla_open`, `v_sla_attainment_daily`, `v_sla_breaches_daily` | — |
| `900_sample_queries.sql` | *(not a migration)* the statements an application runs | — |

Apply in order (each script is safe to re-run):

```bash
for f in database/mysql/0*.sql; do mysql -u "$DB_USER" -p "$DB_NAME" < "$f"; done
```

## Write path (per incident create/update or fired timer)

In **one transaction**:

1. `SELECT record_json FROM incident_sla WHERE incident_id = ? FOR UPDATE`
2. Run `processor.onIncidentChange(...)` or `processor.onTimer(...)`.
3. Save the incident row (yours).
4. Upsert every `result.records[i]` into `incident_sla`, and `result.summary`
   into `incident_sla_summary`.
5. `INSERT IGNORE` every `result.events[i]` into `sla_event`.
6. Insert every `result.scheduleActions[i]` into `sla_schedule_outbox`.

A dispatcher then claims pending outbox rows (`FOR UPDATE SKIP LOCKED`), applies
them with `EventBridgeSlaScheduler`, and marks them `done` or retries with backoff.
Because schedule names are deterministic and deletes ignore "not found", applying
a row twice is harmless.

`record_json` holds the full `StoredSlaRecord` and is passed back to the
processor next time. The other columns are copies of its fields, kept so they
can be indexed for reports and work queues. `dim_priority` and `dim_team` are
generated from `dimensions_json`. Add more generated columns for any other
dimension you group or filter on.
