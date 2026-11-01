-- =============================================================================
-- 900  Sample statements the application runs (not a migration).
-- :named parameters are placeholders — bind them with your MySQL driver.
-- Times: library epoch ms → DATETIME(3) via FROM_UNIXTIME(:ms / 1000).
-- =============================================================================

-- 1) Load stored records before processing a change / timer (lock the rows).
SELECT record_json FROM incident_sla WHERE incident_id = :incidentId FOR UPDATE;

-- 2) Upsert one StoredSlaRecord (inside the incident transaction).
--    The version guard rejects writes based on an outdated read.
INSERT INTO incident_sla (
  incident_id, policy_id, metric, version, state, status, target_seconds,
  started_at, completed_at, due_at, breached_at, elapsed_seconds, remaining_seconds,
  consumed_ratio, met, last_evaluated_at, holds_json, timers_json, dimensions_json, record_json)
VALUES (
  :incidentId, :policyId, :metric, :version, :state, :status, :targetSeconds,
  FROM_UNIXTIME(:startedAtMs / 1000), FROM_UNIXTIME(:completedAtMs / 1000), FROM_UNIXTIME(:dueAtMs / 1000),
  FROM_UNIXTIME(:breachedAtMs / 1000), :elapsedSeconds, :remainingSeconds,
  :consumedRatio, :met, FROM_UNIXTIME(:lastEvaluatedAtMs / 1000), :holdsJson, :timersJson, :dimensionsJson, :recordJson)
ON DUPLICATE KEY UPDATE
  metric = VALUES(metric), version = VALUES(version), state = VALUES(state), status = VALUES(status),
  target_seconds = VALUES(target_seconds), started_at = VALUES(started_at), completed_at = VALUES(completed_at),
  due_at = VALUES(due_at), breached_at = VALUES(breached_at), elapsed_seconds = VALUES(elapsed_seconds),
  remaining_seconds = VALUES(remaining_seconds), consumed_ratio = VALUES(consumed_ratio), met = VALUES(met),
  last_evaluated_at = VALUES(last_evaluated_at), holds_json = VALUES(holds_json), timers_json = VALUES(timers_json),
  dimensions_json = VALUES(dimensions_json), record_json = VALUES(record_json);

-- 3) Upsert the summary.
INSERT INTO incident_sla_summary (incident_id, next_due_at, worst_status, breached, open_count, breached_count)
VALUES (:incidentId, FROM_UNIXTIME(:nextDueAtMs / 1000), :worstStatus, :breached, :openCount, :breachedCount)
ON DUPLICATE KEY UPDATE next_due_at = VALUES(next_due_at), worst_status = VALUES(worst_status),
  breached = VALUES(breached), open_count = VALUES(open_count), breached_count = VALUES(breached_count);

-- 4) Append events idempotently.
INSERT IGNORE INTO sla_event (incident_id, policy_id, metric, event_type, timer_kind, version, status,
  occurred_at, due_at, target_seconds, reason)
VALUES (:incidentId, :policyId, :metric, :type, :kind, :version, :status,
  FROM_UNIXTIME(:atMs / 1000), FROM_UNIXTIME(:dueAtMs / 1000), :targetSeconds, :reason);

-- 5) Queue schedule actions in the outbox.
INSERT INTO sla_schedule_outbox (incident_id, action, schedule_name, fire_at, payload_json)
VALUES (:incidentId, :action, :scheduleName, FROM_UNIXTIME(:fireAtMs / 1000), :payloadJson);

-- 6) Dispatcher: claim a batch (MySQL 8 SKIP LOCKED lets several workers run).
START TRANSACTION;
SELECT id, action, schedule_name, fire_at, payload_json
FROM sla_schedule_outbox
WHERE status = 'pending' AND available_at <= UTC_TIMESTAMP(3)
ORDER BY id
LIMIT 50
FOR UPDATE SKIP LOCKED;
UPDATE sla_schedule_outbox SET status = 'processing', locked_by = :workerId, locked_at = UTC_TIMESTAMP(3)
WHERE id IN (:claimedIds);
COMMIT;

-- 7) Dispatcher: mark the result (exponential backoff on failure).
UPDATE sla_schedule_outbox SET status = 'done', last_error = NULL WHERE id = :id;
UPDATE sla_schedule_outbox
SET status = IF(attempts + 1 >= 10, 'failed', 'pending'),
    attempts = attempts + 1,
    available_at = UTC_TIMESTAMP(3) + INTERVAL LEAST(POW(2, attempts), 900) SECOND,
    last_error = :error
WHERE id = :id;

-- 8) Housekeeping.
DELETE FROM sla_schedule_outbox WHERE status = 'done' AND updated_at < UTC_TIMESTAMP(3) - INTERVAL 7 DAY;
