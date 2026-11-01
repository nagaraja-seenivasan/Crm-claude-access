-- =============================================================================
-- 005  Reporting views over the pre-stored data (no recomputation needed)
-- =============================================================================

-- Open SLAs ordered by urgency (work queue / "about to breach").
CREATE OR REPLACE VIEW v_sla_open AS
SELECT s.incident_id, s.policy_id, s.metric, s.status, s.due_at, s.target_seconds,
       s.consumed_ratio, s.dim_priority, s.dim_team,
       TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(3), s.due_at) AS seconds_to_due
FROM incident_sla s
WHERE s.state = 'running' AND s.completed_at IS NULL;

-- Daily attainment per policy / priority, by completion day.
CREATE OR REPLACE VIEW v_sla_attainment_daily AS
SELECT DATE(s.completed_at)                         AS day,
       s.policy_id,
       s.dim_priority                               AS priority,
       COUNT(*)                                     AS completed,
       SUM(s.met)                                   AS met,
       SUM(s.status = 'breached')                   AS breached,
       ROUND(SUM(s.met) / COUNT(*), 4)              AS attainment,
       ROUND(AVG(s.elapsed_seconds), 1)             AS avg_elapsed_seconds
FROM incident_sla s
WHERE s.completed_at IS NOT NULL AND s.state = 'completed'
GROUP BY DATE(s.completed_at), s.policy_id, s.dim_priority;

-- Breaches per day from the audit log (includes still-open breaches).
CREATE OR REPLACE VIEW v_sla_breaches_daily AS
SELECT DATE(e.occurred_at) AS day, e.policy_id, COUNT(*) AS breaches
FROM sla_event e
WHERE e.event_type = 'breached'
GROUP BY DATE(e.occurred_at), e.policy_id;
