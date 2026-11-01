/**
 * Core type definitions for the SLA engine.
 *
 * The library works exclusively with Unix epoch milliseconds (numbers) on the
 * hot paths. `Date` objects are avoided inside loops because their allocation
 * and getter overhead dominates when evaluating or aggregating large volumes of
 * SLA records. Convert at the edges with {@link toEpochMs}.
 */

/** A point in time, expressed as Unix epoch milliseconds. */
export type EpochMs = number;

/** Anything that can be normalised to epoch milliseconds. */
export type TimeInput = EpochMs | Date | string;

/** 0 = Sunday … 6 = Saturday (matches `Date.prototype.getUTCDay`). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** A half-open working window inside a day, in minutes from local midnight. */
export interface WorkingInterval {
  /** Inclusive start minute, 0–1440. */
  start: number;
  /** Exclusive end minute, 0–1440 and `> start`. */
  end: number;
}

/** Per-weekday working windows. Missing weekdays are treated as non-working. */
export type WeeklySchedule = Partial<Record<Weekday, WorkingInterval[]>>;

/** Configuration for a {@link BusinessCalendar}. */
export interface BusinessCalendarConfig {
  /**
   * Fixed offset (minutes) added to UTC to obtain local civil time, e.g. `330`
   * for IST (UTC+05:30), `-300` for EST. A fixed offset keeps the hot path pure
   * integer arithmetic; daylight-saving transitions are therefore not modelled.
   * For DST-sensitive SLAs, split policies per season or pre-normalise inputs.
   * @default 0
   */
  timeZoneOffsetMinutes?: number;
  /**
   * If `true`, time flows continuously (24×7). All business-time maths collapse
   * to plain arithmetic — the fastest possible path. When set, `week` and
   * `holidays` are ignored.
   */
  continuous?: boolean;
  /**
   * Working windows per weekday. Defaults to Mon–Fri 09:00–17:00 when omitted
   * and `continuous` is not set.
   */
  week?: WeeklySchedule;
  /**
   * Non-working calendar dates. Each entry is either a `YYYY-MM-DD` string
   * (interpreted in the calendar's local time) or an integer "epoch day".
   */
  holidays?: Array<string | number>;
}

/** The lifecycle state of an SLA instance as understood by the engine. */
export type SlaState = 'running' | 'paused' | 'completed' | 'cancelled';

/** The computed outcome of evaluating an SLA instance. */
export type SlaStatus =
  | 'pending' // not started yet
  | 'running' // clock ticking, within target
  | 'paused' // clock held
  | 'met' // completed within target
  | 'breached' // target exceeded (open or on completion)
  | 'cancelled'; // instance was cancelled

/** A span during which the SLA clock was held (e.g. "waiting on customer"). */
export interface HoldWindow {
  from: EpochMs;
  /** Open-ended when omitted — the hold is still active. */
  to?: EpochMs;
  reason?: string;
}

/**
 * A single SLA instance: one target applied to one tracked entity (a ticket,
 * an order, a case …). This is the unit the engine evaluates and reports on.
 */
export interface SlaInstance {
  /** Stable identifier of the tracked entity. */
  id: string;
  /** The policy / target this instance is measured against. */
  policyId: string;
  /** Logical metric name, e.g. `first_response`, `resolution`. */
  metric: string;
  /** Target budget, in business seconds (resolved from the policy). */
  targetSeconds: number;
  /** When the clock started. */
  startedAt: EpochMs;
  /** When the work was completed/stopped, if it has been. */
  completedAt?: EpochMs;
  /** Lifecycle state. */
  state: SlaState;
  /** Paused windows. Business time inside these windows is not counted. */
  holds?: HoldWindow[];
  /** Arbitrary dimensions carried through to reporting (team, priority, …). */
  dimensions?: Record<string, string | number | boolean | null>;
}

/** The result of evaluating an {@link SlaInstance} at a point in time. */
export interface SlaEvaluation {
  id: string;
  policyId: string;
  metric: string;
  status: SlaStatus;
  /** Business seconds consumed so far (excluding holds). */
  elapsedSeconds: number;
  /** Business seconds still available; negative once breached. */
  remainingSeconds: number;
  /** Fraction of the budget consumed (0–1+, can exceed 1 on breach). */
  consumedRatio: number;
  /** The instant the budget is / was exhausted (the deadline). */
  dueAt: EpochMs;
  /** The instant the breach occurred, if it has. */
  breachedAt?: EpochMs;
  /** Whether the target was ultimately met (only meaningful once completed). */
  met: boolean;
  /** The `now` used for the evaluation. */
  evaluatedAt: EpochMs;
  dimensions?: Record<string, string | number | boolean | null>;
}

/** Matches an SLA instance to a target. Higher `priority` wins. */
export interface PolicyRule {
  /** Equality match against instance dimensions; all entries must match. */
  when?: Record<string, string | number | boolean | null>;
  /** Target budget in seconds for this rule. */
  targetSeconds: number;
  /** Larger value = evaluated first. @default 0 */
  priority?: number;
}

/** A named SLA policy: one metric, a calendar, and a set of target rules. */
export interface SlaPolicyConfig {
  id: string;
  name?: string;
  metric: string;
  /** Calendar id this policy measures against (see {@link SlaEngine}). */
  calendarId?: string;
  /** Default target when no rule matches. */
  defaultTargetSeconds: number;
  rules?: PolicyRule[];
}
