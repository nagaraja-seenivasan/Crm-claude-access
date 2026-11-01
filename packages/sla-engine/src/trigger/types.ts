import type {EpochMs, SlaInstance, SlaStatus} from '../types';

/** Any incident-like record. Fields are read by (dotted) path. */
export type IncidentRecord = Record<string, unknown>;

/** Whether the incident was just created or updated. */
export type ChangeKind = 'create' | 'update';

export type ConditionOp =
  | 'eq'
  | 'ne'
  | 'in'
  | 'nin'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'exists'
  | 'missing'
  /** Field value differs between previous and current. */
  | 'changed'
  /** Field changed and the new value equals `value` (or is in `value[]`). */
  | 'changed_to'
  /** Field changed and the old value equals `value` (or is in `value[]`). */
  | 'changed_from';

/** A condition evaluated against the incident change (`previous` → `current`). */
export interface TriggerCondition {
  /** Dotted path into the incident, e.g. `status` or `owner.team`. */
  field: string;
  op: ConditionOp;
  value?: unknown;
}

/** What a lifecycle trigger does to the SLA clock. */
export type LifecycleAction =
  | 'start' // create the SLA record if none exists
  | 'pause' // open a hold (clock stops, deadline moves out)
  | 'resume' // close the open hold
  | 'stop' // complete the SLA (met or breached)
  | 'cancel' // cancel the SLA (excluded from attainment)
  | 'restart' // discard the clock and start a fresh one
  | 'reopen' // un-complete; the closed period is excluded from the clock
  | 'retarget'; // re-resolve the target from the policy rules (e.g. priority changed)

/** Reacts to incident create/update events and drives the SLA clock. */
export interface LifecycleTrigger {
  action: LifecycleAction;
  /** Which change kinds this trigger listens to. @default ['create','update'] */
  on?: ChangeKind[];
  /** All conditions must match (AND). */
  when?: TriggerCondition[];
  /** At least one must match (OR). Combined with `when` using AND. */
  any?: TriggerCondition[];
  /** Stored on holds and events for audit. */
  reason?: string;
}

/** A time-based trigger fired at a point in the SLA budget. */
export interface TimeTrigger {
  /** Unique per config, e.g. `warning`, `breach`, `escalation-1`. */
  kind: string;
  /** Fraction of the target at which to fire: 0.75 = warning, 1 = breach. */
  atRatio: number;
}

/** Binds a registered SLA policy to its triggers and timers. */
export interface SlaTriggerConfig {
  /** Id of a policy registered on the {@link SlaEngine}. */
  policyId: string;
  /** Evaluated in order on every incident change. */
  triggers: LifecycleTrigger[];
  /** Time triggers. @default [{kind: 'breach', atRatio: 1}] */
  timers?: TimeTrigger[];
  /**
   * Incident fields copied into the SLA dimensions (for target rules and
   * reporting). Array of paths (dimension = path) or `{dimension: path}`.
   */
  dimensions?: string[] | Record<string, string>;
}

/** Stored state of one time trigger. */
export interface StoredTimer {
  kind: string;
  atRatio: number;
  /** When it will (or did) fire. */
  fireAt?: EpochMs;
  /** Whether a schedule currently exists in the scheduler. */
  scheduled: boolean;
  /** Record version the live schedule was created for. */
  scheduledVersion?: number;
  firedAt?: EpochMs;
}

/**
 * Everything about one SLA on one incident, pre-computed so it can be saved
 * alongside the incident and reported on without recomputation.
 */
export interface StoredSlaRecord extends SlaInstance {
  /** Incremented on every lifecycle change; stale timer events are dropped. */
  version: number;
  timers: StoredTimer[];
  status: SlaStatus;
  elapsedSeconds: number;
  remainingSeconds: number;
  consumedRatio: number;
  dueAt: EpochMs;
  breachedAt?: EpochMs;
  met: boolean;
  lastEvaluatedAt: EpochMs;
}

/** Flattened per-incident summary, intended for indexed columns. */
export interface SlaSummary {
  /** Earliest deadline among running, not-yet-breached SLAs. */
  nextDueAt: EpochMs | null;
  worstStatus: SlaStatus | null;
  breached: boolean;
  openCount: number;
  breachedCount: number;
}

/** Payload delivered by the scheduler when a timer fires. */
export interface SlaTimerPayload {
  type: 'sla.timer';
  incidentId: string;
  policyId: string;
  metric: string;
  kind: string;
  version: number;
  fireAt: EpochMs;
}

export type ScheduleAction =
  | {type: 'upsert'; name: string; fireAt: EpochMs; payload: SlaTimerPayload}
  | {type: 'delete'; name: string};

export type SlaEventType =
  | 'started'
  | 'paused'
  | 'resumed'
  | 'stopped'
  | 'cancelled'
  | 'restarted'
  | 'reopened'
  | 'retargeted'
  | 'timer'
  | 'breached'
  | 'met';

/** An audit/integration event produced by the processor. */
export interface SlaEvent {
  type: SlaEventType;
  incidentId: string;
  policyId: string;
  metric: string;
  at: EpochMs;
  version: number;
  /** Timer kind for `timer` events. */
  kind?: string;
  reason?: string;
  status: SlaStatus;
  dueAt: EpochMs;
  targetSeconds: number;
}

/** What the application must persist / execute after processing. */
export interface SlaProcessResult {
  incidentId: string;
  /** Save these with the incident (same transaction). */
  records: StoredSlaRecord[];
  /** Save these on the incident for indexed queries. */
  summary: SlaSummary;
  /** Apply to the scheduler (ideally via an outbox). */
  scheduleActions: ScheduleAction[];
  /** Append to an audit table and/or publish (e.g. EventBridge PutEvents). */
  events: SlaEvent[];
  /** Whether anything changed compared with the input records. */
  changed: boolean;
  /** `onTimer` only: the timer was outdated and ignored. */
  stale?: boolean;
}

/** Port the application implements (or uses {@link EventBridgeSlaScheduler}). */
export interface SlaScheduler {
  apply(actions: ScheduleAction[]): Promise<ScheduleActionResult[]>;
}

export interface ScheduleActionResult {
  action: ScheduleAction;
  ok: boolean;
  error?: unknown;
}
