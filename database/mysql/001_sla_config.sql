-- =============================================================================
-- 001  SLA configuration: calendars, policies, trigger configs
-- MySQL 8.0+ (InnoDB, utf8mb4). All timestamps are UTC.
-- Shapes mirror @crm/sla-engine: BusinessCalendarConfig, SlaPolicyConfig,
-- SlaTriggerConfig. JSON columns hold the library objects verbatim.
-- =============================================================================

CREATE TABLE IF NOT EXISTS sla_calendar (
  id                       VARCHAR(64)  NOT NULL,
  name                     VARCHAR(128) NOT NULL,
  time_zone_offset_minutes SMALLINT     NOT NULL DEFAULT 0,
  continuous               TINYINT(1)   NOT NULL DEFAULT 0,
  week_json                JSON         NULL COMMENT 'WeeklySchedule: {"1":[{"start":540,"end":1020}],...}',
  holidays_json            JSON         NULL COMMENT 'Array of YYYY-MM-DD',
  is_active                TINYINT(1)   NOT NULL DEFAULT 1,
  created_at               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS sla_policy (
  id                     VARCHAR(64)  NOT NULL,
  name                   VARCHAR(128) NOT NULL,
  metric                 VARCHAR(64)  NOT NULL COMMENT 'e.g. first_response, resolution',
  calendar_id            VARCHAR(64)  NOT NULL,
  default_target_seconds INT UNSIGNED NOT NULL,
  rules_json             JSON         NULL COMMENT 'PolicyRule[]: [{"when":{"priority":"P1"},"targetSeconds":14400,"priority":10}]',
  is_active              TINYINT(1)   NOT NULL DEFAULT 1,
  created_at             DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at             DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_sla_policy_calendar (calendar_id),
  CONSTRAINT fk_sla_policy_calendar FOREIGN KEY (calendar_id) REFERENCES sla_calendar (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS sla_trigger_config (
  policy_id        VARCHAR(64) NOT NULL,
  triggers_json    JSON        NOT NULL COMMENT 'LifecycleTrigger[]',
  timers_json      JSON        NULL     COMMENT 'TimeTrigger[]: [{"kind":"warning","atRatio":0.75}]',
  dimensions_json  JSON        NULL     COMMENT 'string[] or {dimension: path}',
  is_active        TINYINT(1)  NOT NULL DEFAULT 1,
  created_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (policy_id),
  CONSTRAINT fk_sla_trigger_policy FOREIGN KEY (policy_id) REFERENCES sla_policy (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
