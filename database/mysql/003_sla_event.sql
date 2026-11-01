-- =============================================================================
-- 003  SLA event audit log (append-only), from SlaProcessResult.events
-- The unique key makes re-processing the same change/timer idempotent:
-- INSERT IGNORE (or ON DUPLICATE KEY UPDATE id = id).
-- =============================================================================

CREATE TABLE IF NOT EXISTS sla_event (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  incident_id     VARCHAR(64)  NOT NULL,
  policy_id       VARCHAR(64)  NOT NULL,
  metric          VARCHAR(64)  NOT NULL,
  event_type      ENUM('started','paused','resumed','stopped','cancelled','restarted',
                       'reopened','retargeted','timer','breached','met') NOT NULL,
  timer_kind      VARCHAR(32)  NULL COMMENT 'Set for event_type = timer (warning, breach, ...)',
  version         INT UNSIGNED NOT NULL,
  status          ENUM('pending','running','paused','met','breached','cancelled') NOT NULL,
  occurred_at     DATETIME(3)  NOT NULL,
  due_at          DATETIME(3)  NOT NULL,
  target_seconds  INT UNSIGNED NOT NULL,
  reason          VARCHAR(128) NULL,
  published_at    DATETIME(3)  NULL COMMENT 'Set once forwarded to EventBridge (PutEvents)',
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  timer_kind_key  VARCHAR(32)  AS (COALESCE(timer_kind, '')) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY ux_sla_event_idem (incident_id, policy_id, version, event_type, timer_kind_key),
  KEY ix_sla_event_type_time (event_type, occurred_at),
  KEY ix_sla_event_policy_time (policy_id, occurred_at),
  KEY ix_sla_event_unpublished (published_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
