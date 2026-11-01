import type {BusinessCalendar} from './calendar';
import {toEpochMs} from './time';
import type {EpochMs, HoldWindow, SlaEvaluation, SlaInstance} from './types';

/**
 * Compute business seconds spent inside hold windows between `start` and `end`.
 * Hold windows are clamped to the `[start, end]` range and their business time
 * is subtracted from the elapsed clock.
 */
function heldSeconds(
  cal: BusinessCalendar,
  holds: HoldWindow[] | undefined,
  start: EpochMs,
  end: EpochMs,
): number {
  if (!holds || holds.length === 0) return 0;
  let held = 0;
  for (let i = 0; i < holds.length; i++) {
    const from = holds[i].from < start ? start : holds[i].from;
    const to = Math.min(holds[i].to ?? end, end);
    if (to > from) held += cal.businessSecondsBetween(from, to);
  }
  return held;
}

/** Whether a hold is currently open at `now`. */
function isPaused(holds: HoldWindow[] | undefined, now: EpochMs): boolean {
  if (!holds) return false;
  for (let i = 0; i < holds.length; i++) {
    const to = holds[i].to;
    if (holds[i].from <= now && (to === undefined || to > now)) {
      return true;
    }
  }
  return false;
}

/**
 * Evaluate a single SLA instance against a business calendar at time `now`.
 *
 * The clock counts business time from `startedAt` to the end point (completion
 * or `now`), minus any business time spent on hold. The deadline (`dueAt`) is
 * `startedAt` plus the target budget *plus* the held business time, pushed out
 * so holds genuinely stop the clock.
 */
export function evaluateInstance(
  instance: SlaInstance,
  cal: BusinessCalendar,
  now: EpochMs = Date.now(),
): SlaEvaluation {
  const {id, policyId, metric, targetSeconds, dimensions} = instance;
  const start = instance.startedAt;

  if (instance.state === 'cancelled') {
    return result('cancelled', 0, targetSeconds, 0, cal.addBusinessSeconds(start, targetSeconds), false);
  }

  const end = instance.completedAt ?? now;
  const grossSeconds = cal.businessSecondsBetween(start, end);
  const held = heldSeconds(cal, instance.holds, start, end);
  const elapsed = Math.max(0, grossSeconds - held);
  const remaining = targetSeconds - elapsed;

  // Deadline accounts for held time, so an instance on hold does not breach.
  const dueAt = cal.addBusinessSeconds(start, targetSeconds + held);

  const completed = instance.state === 'completed' || instance.completedAt !== undefined;
  const paused = !completed && isPaused(instance.holds, now);
  const breached = elapsed > targetSeconds;
  const breachedAt = breached ? cal.addBusinessSeconds(start, targetSeconds + held) : undefined;

  let status: SlaEvaluation['status'];
  if (now < start && !completed) status = 'pending';
  else if (completed) status = breached ? 'breached' : 'met';
  else if (breached) status = 'breached';
  else if (paused) status = 'paused';
  else status = 'running';

  return result(status, elapsed, remaining, targetSeconds > 0 ? elapsed / targetSeconds : 0, dueAt, completed && !breached, breachedAt);

  function result(
    status: SlaEvaluation['status'],
    elapsedSeconds: number,
    remainingSeconds: number,
    consumedRatio: number,
    due: EpochMs,
    met: boolean,
    breachAt?: EpochMs,
  ): SlaEvaluation {
    return {
      id,
      policyId,
      metric,
      status,
      elapsedSeconds,
      remainingSeconds,
      consumedRatio,
      dueAt: due,
      breachedAt: breachAt,
      met,
      evaluatedAt: now,
      dimensions,
    };
  }
}

/** Convenience: evaluate using a raw time input for `now`. */
export function evaluateAt(
  instance: SlaInstance,
  cal: BusinessCalendar,
  now: EpochMs | Date | string,
): SlaEvaluation {
  return evaluateInstance(instance, cal, toEpochMs(now));
}
