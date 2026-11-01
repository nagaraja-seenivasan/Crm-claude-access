-- =============================================================================
-- 004  Transactional outbox for EventBridge Scheduler actions
-- Insert SlaProcessResult.scheduleActions in the same transaction as the
-- incident + incident_sla write. A dispatcher claims pending rows, applies them
-- with EventBridgeSlaScheduler, and marks them done/failed (with backoff).
-- Schedule names are deterministic, so applying a row twice is harmless.
-- =============================================================================

CREATE TABLE IF NOT EXISTS sla_schedule_outbox (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  incident_id    VARCHAR(64)  NOT NULL,
  action         ENUM('upsert','delete') NOT NULL,
  schedule_name  VARCHAR(64)  NOT NULL,
  fire_at        DATETIME(3)  NULL     COMMENT 'upsert only',
  payload_json   JSON         NULL     COMMENT 'SlaTimerPayload, upsert only',
  status         ENUM('pending','processing','done','failed') NOT NULL DEFAULT 'pending',
  attempts       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  available_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Next attempt (backoff)',
  locked_by      VARCHAR(64)  NULL,
  locked_at      DATETIME(3)  NULL,
  last_error     VARCHAR(1024) NULL,
  created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_outbox_pending (status, available_at, id),
  KEY ix_outbox_schedule (schedule_name, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
