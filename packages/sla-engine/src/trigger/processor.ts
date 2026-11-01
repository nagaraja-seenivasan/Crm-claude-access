import type {SlaEngine} from '../engine';
import {heldBusinessSeconds, isPaused, evaluateInstance} from '../tracker';
import type {EpochMs, SlaEvaluation, SlaStatus} from '../types';
import {getPath, triggerMatches, type ChangeContext} from './conditions';
import type {
  IncidentRecord,
  LifecycleAction,
  LifecycleTrigger,
  ScheduleAction,
  SlaEvent,
  SlaEventType,
  SlaProcessResult,
  SlaSummary,
  SlaTimerPayload,
  SlaTriggerConfig,
  StoredSlaRecord,
  StoredTimer,
  TimeTrigger,
} from './types';

export interface SlaTriggerProcessorOptions {
  /** Prefix for schedule names. @default 'sla' */
  schedulePrefix?: string;
  /** Field holding the incident id when `incidentId` is not passed. @default 'id' */
  idField?: string;
}

const DEFAULT_TIMERS: TimeTrigger[] = [{kind: 'breach', atRatio: 1}];

/**
 * Turns incident create/update events and fired timers into:
 *  - SLA records to **store with the incident** (all values pre-computed),
 *  - a flat {@link SlaSummary} for indexed columns,
 *  - scheduler actions (one-time schedules for warning/breach timers),
 *  - audit/integration events.
 *
 * It is **pure**: no I/O, no clock reads beyond the `now` you pass. Your
 * application persists the result and applies the schedule actions (for
 * example with {@link EventBridgeSlaScheduler}). The same inputs always give
 * the same outputs, so retries are safe.
 */
export class SlaTriggerProcessor {
  private readonly configs: SlaTriggerConfig[];
  private readonly prefix: string;
  private readonly idField: string;

  constructor(
    private readonly engine: SlaEngine,
    configs: SlaTriggerConfig[],
    options: SlaTriggerProcessorOptions = {},
  ) {
    const kinds = new Set<string>();
    for (const c of configs) {
      engine.getPolicy(c.policyId); // fail fast on unknown policy
      kinds.clear();
      for (const t of c.timers ?? DEFAULT_TIMERS) {
        if (kinds.has(t.kind)) throw new Error(`Duplicate timer '${t.kind}' in ${c.policyId}`);
        if (!(t.atRatio > 0)) throw new RangeError(`Timer '${t.kind}' atRatio must be > 0`);
        kinds.add(t.kind);
      }
    }
    this.configs = configs;
    this.prefix = options.schedulePrefix ?? 'sla';
    this.idField = options.idField ?? 'id';
  }

  /**
   * Process an incident create (no `previous`) or update. Pass the SLA records
   * currently stored for the incident (empty on create).
   */
  onIncidentChange(input: {
    current: IncidentRecord;
    previous?: IncidentRecord;
    records?: StoredSlaRecord[];
    incidentId?: string;
    now?: EpochMs;
  }): SlaProcessResult {
    const now = input.now ?? Date.now();
    const incidentId = input.incidentId ?? String(getPath(input.current, this.idField));
    if (!incidentId || incidentId === 'undefined') throw new Error('Incident id is required');

    const ctx: ChangeContext = {
      change: input.previous ? 'update' : 'create',
      current: input.current,
      previous: input.previous,
    };
    const run = new Run(incidentId, now);
    const byPolicy = new Map((input.records ?? []).map(r => [r.policyId, cloneRecord(r)]));
    const out: StoredSlaRecord[] = [];

    for (const cfg of this.configs) {
      let rec = byPolicy.get(cfg.policyId);
      byPolicy.delete(cfg.policyId);
      const before = rec ? JSON.stringify(rec) : '';
      const dims = this.dimensions(cfg, input.current);

      for (const t of cfg.triggers) {
        if (triggerMatches(t, ctx)) rec = this.apply(t, rec, cfg, dims, run);
      }
      if (!rec) continue;
      rec.dimensions = dims;
      this.finalize(rec, cfg, run);
      if (JSON.stringify(rec) !== before) run.changed = true;
      out.push(rec);
    }
    // Keep records whose policy is no longer configured, untouched.
    for (const rec of byPolicy.values()) out.push(rec);

    return run.result(out);
  }

  /**
   * Handle a fired timer (the scheduler's payload). Outdated timers — version
   * mismatch, already fired, or SLA no longer running — return `stale: true`
   * and change nothing.
   */
  onTimer(input: {
    payload: SlaTimerPayload;
    records: StoredSlaRecord[];
    now?: EpochMs;
  }): SlaProcessResult {
    const {payload} = input;
    const records = input.records.map(cloneRecord);
    const rec = records.find(r => r.policyId === payload.policyId);
    const cfg = this.configs.find(c => c.policyId === payload.policyId);
    const timer = rec?.timers.find(t => t.kind === payload.kind);
    const run = new Run(payload.incidentId, input.now ?? Date.now());

    if (
      !rec ||
      !cfg ||
      !timer ||
      rec.version !== payload.version ||
      timer.firedAt !== undefined ||
      rec.state !== 'running' ||
      rec.completedAt !== undefined
    ) {
      return {...run.result(input.records), stale: true};
    }
    // One-time schedules delete themselves after running.
    timer.scheduled = false;
    timer.scheduledVersion = undefined;
    // Scheduler delivery can be slightly early relative to our clock.
    if (timer.fireAt !== undefined && run.now < timer.fireAt) run.now = timer.fireAt;
    this.finalize(rec, cfg, run);
    run.changed = true;
    return run.result(records);
  }

  /** Name of the schedule for a timer (deterministic, ≤ 64 chars, AWS-safe). */
  scheduleName(incidentId: string, policyId: string, kind: string): string {
    const raw = `${this.prefix}-${incidentId}-${policyId}-${kind}`.replace(/[^0-9A-Za-z_.-]/g, '_');
    if (raw.length <= 64) return raw;
    return `${raw.slice(0, 55)}-${fnv1a(raw)}`;
  }

  // --- internals ---------------------------------------------------------

  private dimensions(cfg: SlaTriggerConfig, incident: IncidentRecord): StoredSlaRecord['dimensions'] {
    const spec = cfg.dimensions;
    if (!spec) return {};
    const entries: Array<[string, string]> = Array.isArray(spec)
      ? spec.map(p => [p, p])
      : Object.entries(spec);
    const dims: NonNullable<StoredSlaRecord['dimensions']> = {};
    for (const [name, path] of entries) {
      const v = getPath(incident, path);
      dims[name] =
        v === undefined || v === null
          ? null
          : typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
            ? v
            : String(v);
    }
    return dims;
  }

  private newRecord(
    cfg: SlaTriggerConfig,
    incidentId: string,
    dims: StoredSlaRecord['dimensions'],
    now: EpochMs,
    version: number,
  ): StoredSlaRecord {
    const inst = this.engine.startInstance({id: incidentId, policyId: cfg.policyId, startedAt: now, dimensions: dims});
    return {
      ...inst,
      holds: [],
      version,
      timers: (cfg.timers ?? DEFAULT_TIMERS).map(t => ({kind: t.kind, atRatio: t.atRatio, scheduled: false})),
      status: 'running',
      elapsedSeconds: 0,
      remainingSeconds: inst.targetSeconds,
      consumedRatio: 0,
      dueAt: now,
      met: false,
      lastEvaluatedAt: now,
    };
  }

  private apply(
    t: LifecycleTrigger,
    rec: StoredSlaRecord | undefined,
    cfg: SlaTriggerConfig,
    dims: StoredSlaRecord['dimensions'],
    run: Run,
  ): StoredSlaRecord | undefined {
    const now = run.now;
    const open = rec !== undefined && rec.state === 'running' && rec.completedAt === undefined;
    const openHold = rec?.holds?.find(h => h.to === undefined);
    const bump = (r: StoredSlaRecord, type: SlaEventType): StoredSlaRecord => {
      r.version += 1;
      run.pending.push({rec: r, type, reason: t.reason});
      return r;
    };
    const action: LifecycleAction = t.action;

    switch (action) {
      case 'start':
        if (rec) return rec;
        return bump(this.newRecord(cfg, run.incidentId, dims, now, 0), 'started');

      case 'restart': {
        const fresh = this.newRecord(cfg, run.incidentId, dims, now, rec ? rec.version : 0);
        // Remove schedules belonging to the discarded clock.
        if (rec) for (const tm of rec.timers) if (tm.scheduled) run.del(this.scheduleName(run.incidentId, rec.policyId, tm.kind));
        return bump(fresh, rec ? 'restarted' : 'started');
      }

      case 'pause':
        if (!open || openHold) return rec;
        rec!.holds = [...(rec!.holds ?? []), {from: now, reason: t.reason}];
        return bump(rec!, 'paused');

      case 'resume':
        if (!open || !openHold) return rec;
        openHold.to = now;
        return bump(rec!, 'resumed');

      case 'stop':
        if (!open) return rec;
        if (openHold) openHold.to = now;
        rec!.completedAt = now;
        rec!.state = 'completed';
        return bump(rec!, 'stopped');

      case 'cancel':
        if (!rec || rec.state === 'cancelled') return rec;
        if (openHold) openHold.to = now;
        rec.state = 'cancelled';
        return bump(rec, 'cancelled');

      case 'reopen':
        if (!rec || rec.state !== 'completed' || rec.completedAt === undefined) return rec;
        // The time it spent closed does not count against the SLA.
        rec.holds = [...(rec.holds ?? []), {from: rec.completedAt, to: now, reason: t.reason ?? 'closed'}];
        rec.completedAt = undefined;
        rec.state = 'running';
        rec.met = false;
        return bump(rec, 'reopened');

      case 'retarget': {
        if (!open) return rec;
        const target = this.engine.getPolicy(cfg.policyId).resolveTargetSeconds(dims);
        if (target === rec!.targetSeconds) return rec;
        rec!.targetSeconds = target;
        rec!.dimensions = dims;
        return bump(rec!, 'retargeted');
      }
    }
    return rec;
  }

  /** Re-evaluate, reconcile timers/schedules, and emit status transitions. */
  private finalize(rec: StoredSlaRecord, cfg: SlaTriggerConfig, run: Run): void {
    const now = run.now;
    const policy = this.engine.getPolicy(cfg.policyId);
    const cal = this.engine.getCalendar(policy.calendarId);
    const prevStatus = rec.status;
    const active = rec.state === 'running' && rec.completedAt === undefined && !isPaused(rec.holds, now);
    const held = heldBusinessSeconds(cal, rec.holds, rec.startedAt, rec.completedAt ?? now);
    const fired: StoredTimer[] = [];

    for (const tm of rec.timers) {
      const name = this.scheduleName(run.incidentId, rec.policyId, tm.kind);
      if (!active) {
        if (tm.scheduled) run.del(name);
        tm.scheduled = false;
        tm.scheduledVersion = undefined;
        continue;
      }
      const fireAt = ceilSecond(cal.addBusinessSeconds(rec.startedAt, rec.targetSeconds * tm.atRatio + held));
      // Re-arm a fired timer whose moment moved into the future (e.g. retarget).
      if (tm.firedAt !== undefined && fireAt > now) tm.firedAt = undefined;
      if (tm.firedAt !== undefined) {
        tm.scheduled = false;
        continue;
      }
      tm.fireAt = fireAt;
      if (fireAt <= now) {
        // Due already (missed or catching up) — fire inline, no schedule needed.
        if (tm.scheduled) run.del(name);
        tm.scheduled = false;
        tm.scheduledVersion = undefined;
        tm.firedAt = now;
        fired.push(tm);
        continue;
      }
      if (!tm.scheduled || tm.scheduledVersion !== rec.version) {
        run.actions.push({
          type: 'upsert',
          name,
          fireAt,
          payload: {
            type: 'sla.timer',
            incidentId: run.incidentId,
            policyId: rec.policyId,
            metric: rec.metric,
            kind: tm.kind,
            version: rec.version,
            fireAt,
          },
        });
        tm.scheduled = true;
        tm.scheduledVersion = rec.version;
      }
    }

    const ev: SlaEvaluation = evaluateInstance(rec, cal, now);
    rec.status = ev.status;
    rec.elapsedSeconds = ev.elapsedSeconds;
    rec.remainingSeconds = ev.remainingSeconds;
    rec.consumedRatio = ev.consumedRatio;
    rec.dueAt = ev.dueAt;
    rec.breachedAt = ev.breachedAt;
    rec.met = ev.met;
    rec.lastEvaluatedAt = now;

    // Lifecycle events collected during apply() now carry the final status.
    for (const p of run.pending.splice(0)) run.emit(p.rec, p.type, p.reason);
    for (const tm of fired) run.emit(rec, 'timer', undefined, tm.kind);
    if (ev.status === 'breached' && prevStatus !== 'breached') run.emit(rec, 'breached', undefined, undefined, ev.breachedAt);
    if (ev.status === 'met' && prevStatus !== 'met') run.emit(rec, 'met');
  }
}

/** Mutable accumulator for one processing call. */
class Run {
  readonly actions: ScheduleAction[] = [];
  readonly events: SlaEvent[] = [];
  readonly pending: Array<{rec: StoredSlaRecord; type: SlaEventType; reason?: string}> = [];
  changed = false;

  constructor(readonly incidentId: string, public now: EpochMs) {}

  del(name: string): void {
    if (!this.actions.some(a => a.type === 'delete' && a.name === name)) this.actions.push({type: 'delete', name});
  }

  emit(rec: StoredSlaRecord, type: SlaEventType, reason?: string, kind?: string, at?: EpochMs): void {
    this.events.push({
      type,
      incidentId: this.incidentId,
      policyId: rec.policyId,
      metric: rec.metric,
      at: at ?? this.now,
      version: rec.version,
      kind,
      reason,
      status: rec.status,
      dueAt: rec.dueAt,
      targetSeconds: rec.targetSeconds,
    });
  }

  result(records: StoredSlaRecord[]): SlaProcessResult {
    // An upsert after a delete of the same name wins; drop the redundant delete.
    const upserts = new Set(this.actions.filter(a => a.type === 'upsert').map(a => a.name));
    const actions = this.actions.filter(a => a.type === 'upsert' || !upserts.has(a.name));
    return {
      incidentId: this.incidentId,
      records,
      summary: summarize(records),
      scheduleActions: actions,
      events: this.events,
      changed: this.changed,
    };
  }
}

const STATUS_RANK: Record<SlaStatus, number> = {
  breached: 6,
  running: 5,
  paused: 4,
  pending: 3,
  met: 2,
  cancelled: 1,
};

/** Flatten records into indexable summary columns. */
export function summarize(records: StoredSlaRecord[]): SlaSummary {
  let nextDueAt: number | null = null;
  let worst: SlaStatus | null = null;
  let openCount = 0;
  let breachedCount = 0;
  for (const r of records) {
    if (r.status === 'breached') breachedCount++;
    if (r.state === 'running' && r.completedAt === undefined) openCount++;
    if (r.status === 'running' && (nextDueAt === null || r.dueAt < nextDueAt)) nextDueAt = r.dueAt;
    if (worst === null || STATUS_RANK[r.status] > STATUS_RANK[worst]) worst = r.status;
  }
  return {nextDueAt, worstStatus: worst, breached: breachedCount > 0, openCount, breachedCount};
}

/**
 * View a stored record as an {@link SlaEvaluation}, so reports can be built
 * from stored data with `buildReport` — no recomputation.
 */
export function recordToEvaluation(rec: StoredSlaRecord): SlaEvaluation {
  return {
    id: rec.id,
    policyId: rec.policyId,
    metric: rec.metric,
    status: rec.status,
    elapsedSeconds: rec.elapsedSeconds,
    remainingSeconds: rec.remainingSeconds,
    consumedRatio: rec.consumedRatio,
    dueAt: rec.dueAt,
    breachedAt: rec.breachedAt,
    met: rec.met,
    evaluatedAt: rec.lastEvaluatedAt,
    dimensions: rec.dimensions,
  };
}

function cloneRecord(r: StoredSlaRecord): StoredSlaRecord {
  return {
    ...r,
    holds: (r.holds ?? []).map(h => ({...h})),
    timers: r.timers.map(t => ({...t})),
    dimensions: r.dimensions ? {...r.dimensions} : undefined,
  };
}

function ceilSecond(ms: EpochMs): EpochMs {
  return Math.ceil(ms / 1000) * 1000;
}

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
