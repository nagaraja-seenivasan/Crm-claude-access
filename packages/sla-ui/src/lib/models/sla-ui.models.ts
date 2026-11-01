/**
 * View-models and re-exports used across the SLA UI components.
 *
 * The UI speaks the same vocabulary as `@crm/sla-engine`, so its config types
 * are re-exported here to keep a single source of truth. Components emit these
 * exact shapes, which can be persisted and fed straight back into the engine.
 */
export type {
  SlaPolicyConfig,
  PolicyRule,
  BusinessCalendarConfig,
  WeeklySchedule,
  WorkingInterval,
  Weekday,
  SlaInstance,
  SlaEvaluation,
  ReportDefinition,
  ReportResult,
  ReportRow,
  ReportFilter,
  MeasureField,
  GroupStats,
} from '@crm/sla-engine';

/** A dimension a report can group or filter by, with a human label. */
export interface DimensionDef {
  /** Key as it appears on `SlaInstance.dimensions` or an evaluation field. */
  key: string;
  /** Display label. */
  label: string;
  /** Known values, used to populate filter pickers (optional). */
  values?: Array<string | number>;
}

/** A named, saveable SLA calendar entry for the policy builder. */
export interface NamedCalendar {
  id: string;
  name: string;
  config: import('@crm/sla-engine').BusinessCalendarConfig;
}

/** Unit used when entering a target duration in the UI. */
export type DurationUnit = 'seconds' | 'minutes' | 'hours' | 'days';

/** Convert a UI duration (value + unit) to seconds. */
export function toSeconds(value: number, unit: DurationUnit): number {
  switch (unit) {
    case 'seconds':
      return value;
    case 'minutes':
      return value * 60;
    case 'hours':
      return value * 3600;
    case 'days':
      return value * 86400;
  }
}

/** Convert seconds to the largest whole UI unit for display. */
export function fromSeconds(seconds: number): {value: number; unit: DurationUnit} {
  if (seconds % 86400 === 0 && seconds >= 86400) return {value: seconds / 86400, unit: 'days'};
  if (seconds % 3600 === 0 && seconds >= 3600) return {value: seconds / 3600, unit: 'hours'};
  if (seconds % 60 === 0 && seconds >= 60) return {value: seconds / 60, unit: 'minutes'};
  return {value: seconds, unit: 'seconds'};
}

/** A saved report, pairing a definition with an optional display preference. */
export interface SavedReport {
  definition: import('@crm/sla-engine').ReportDefinition;
  /** How this report should be presented by default. */
  view: 'dashboard' | 'grid';
}

/** Format a seconds value as `Hh Mm` / `Dd Hh` for grid/dashboard display. */
export function formatDuration(seconds: number): string {
  if (!isFinite(seconds)) return '—';
  const sign = seconds < 0 ? '-' : '';
  let s = Math.abs(Math.round(seconds));
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (!parts.length) parts.push(`${s}s`);
  return sign + parts.slice(0, 2).join(' ');
}
