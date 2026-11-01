/**
 * `@crm/sla-engine` — a high-performance, dependency-free SLA engine for
 * Node.js and the browser.
 *
 * Highlights:
 *  - Business-hours/calendar maths with week-leaping (O(weeks), not O(days)).
 *  - Pause/resume (hold) aware SLA clocks and deadline computation.
 *  - A report-optimised, single-pass streaming aggregation engine with O(1)
 *    memory per group and P² streaming percentiles.
 */
export {BusinessCalendar} from './calendar';
export {SlaPolicy} from './policy';
export {SlaEngine} from './engine';
export {evaluateInstance, evaluateAt} from './tracker';
export {toEpochMs} from './time';

export * from './report/index';

export type {
  EpochMs,
  TimeInput,
  Weekday,
  WorkingInterval,
  WeeklySchedule,
  BusinessCalendarConfig,
  SlaState,
  SlaStatus,
  HoldWindow,
  SlaInstance,
  SlaEvaluation,
  PolicyRule,
  SlaPolicyConfig,
} from './types';
