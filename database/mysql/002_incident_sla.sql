-- =============================================================================
-- 002  Pre-stored SLA details per incident
-- Written in the SAME transaction as the incident create/update, from
-- SlaProcessResult.records (one row per incident + policy) and .summary.
-- =============================================================================

CREATE TABLE IF NOT EXISTS incident_sla (
  incident_id        VARCHAR(64)  NOT NULL,
  policy_id          VARCHAR(64)  NOT NULL,
  metric             VARCHAR(64)  NOT NULL,
  version            INT UNSIGNED NOT NULL COMMENT 'StoredSlaRecord.version; optimistic concurrency + stale timer guard',
  state              ENUM('running','paused','completed','cancelled') NOT NULL,
  status             ENUM('pending','running','paused','met','breached','cancelled') NOT NULL,
  target_seconds     INT UNSIGNED NOT NULL,
  started_at         DATETIME(3)  NOT NULL,
  completed_at       DATETIME(3)  NULL,
  due_at             DATETIME(3)  NOT NULL,
  breached_at        DATETIME(3)  NULL,
  elapsed_seconds    DECIMAL(14,3) NOT NULL DEFAULT 0,
  remaining_seconds  DECIMAL(14,3) NOT NULL DEFAULT 0,
  consumed_ratio     DECIMAL(10,4) NOT NULL DEFAULT 0,
  met                TINYINT(1)   NOT NULL DEFAULT 0,
  last_evaluated_at  DATETIME(3)  NOT NULL,
  holds_json         JSON         NULL COMMENT 'HoldWindow[] (epoch ms)',
  timers_json        JSON         NOT NULL COMMENT 'StoredTimer[] (epoch ms)',
  dimensions_json    JSON         NULL,
  record_json        JSON         NOT NULL COMMENT 'Full StoredSlaRecord, fed back to the processor on the next change',
  -- Common dimensions as generated columns so reports can group/filter on an index.
  dim_priority       VARCHAR(32)  AS (JSON_UNQUOTE(JSON_EXTRACT(dimensions_json, '$.priority'))) STORED,
  dim_team           VARCHAR(64)  AS (JSON_UNQUOTE(JSON_EXTRACT(dimensions_json, '$.team'))) STORED,
  created_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (incident_id, policy_id),
  KEY ix_incident_sla_open_due (state, status, due_at),
  KEY ix_incident_sla_policy_started (policy_id, started_at),
  KEY ix_incident_sla_breached (status, breached_at),
  KEY ix_incident_sla_priority (dim_priority, status),
  KEY ix_incident_sla_team (dim_team, status),
  CONSTRAINT fk_incident_sla_policy FOREIGN KEY (policy_id) REFERENCES sla_policy (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Flat per-incident summary (SlaProcessResult.summary) for list views/queues.
-- If you own the incident table, you may add these columns to it instead
-- (see the commented ALTER below) and skip this table.
CREATE TABLE IF NOT EXISTS incident_sla_summary (
  incident_id     VARCHAR(64) NOT NULL,
  next_due_at     DATETIME(3) NULL,
  worst_status    ENUM('pending','running','paused','met','breached','cancelled') NULL,
  breached        TINYINT(1)  NOT NULL DEFAULT 0,
  open_count      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  breached_count  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (incident_id),
  KEY ix_sla_summary_next_due (next_due_at),
  KEY ix_sla_summary_worst (worst_status, next_due_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Alternative: keep the summary on your incident table.
-- ALTER TABLE incident
--   ADD COLUMN sla_next_due_at    DATETIME(3) NULL,
--   ADD COLUMN sla_worst_status   ENUM('pending','running','paused','met','breached','cancelled') NULL,
--   ADD COLUMN sla_breached       TINYINT(1) NOT NULL DEFAULT 0,
--   ADD COLUMN sla_open_count     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
--   ADD COLUMN sla_breached_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
--   ADD KEY ix_incident_sla_next_due (sla_next_due_at);
