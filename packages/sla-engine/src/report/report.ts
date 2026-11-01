import type {SlaEvaluation} from '../types';
import {GroupAccumulator, type GroupStats, type QuantileSpec} from './accumulator';

/** The numeric field of an evaluation a report measures. */
export type MeasureField = 'elapsedSeconds' | 'remainingSeconds' | 'consumedRatio';

/** An equality/inequality filter compiled into a fast predicate. */
export interface ReportFilter {
  field: keyof SlaEvaluation | string;
  op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';
  value: unknown;
}

/** Optional time bucketing for trend reports (e.g. daily breach counts). */
export interface TimeBucket {
  /** Evaluation time field to bucket on. */
  field: 'evaluatedAt' | 'dueAt' | 'breachedAt';
  /** Bucket width in milliseconds (e.g. 86_400_000 for daily). */
  widthMs: number;
}

/**
 * A declarative report definition. The same definition powers both the
 * dashboard (summary + grouped tiles) and the downloadable gridview (one row
 * per group) on the Angular side.
 */
export interface ReportDefinition {
  id: string;
  name?: string;
  /** Dimensions to group by (from `evaluation.dimensions` or top-level fields). */
  groupBy?: string[];
  /** Which numeric field to summarise. @default 'elapsedSeconds' */
  measure?: MeasureField;
  /** Quantiles to estimate per group, as fractions. @default [0.5, 0.9, 0.95] */
  quantiles?: QuantileSpec;
  /** Row filters; all must pass. */
  filters?: ReportFilter[];
  /** Optional time bucketing, appended as a `__bucket` group key. */
  bucket?: TimeBucket;
  /** Cap the number of returned rows (after sorting). */
  limit?: number;
  /** Sort rows by a group-stat field, descending by default. */
  sortBy?: keyof GroupStats;
  sortDir?: 'asc' | 'desc';
}

/** One grouped row of a report. */
export interface ReportRow {
  key: Record<string, string | number | boolean | null>;
  stats: GroupStats;
}

/** The full report result: a global summary plus grouped rows. */
export interface ReportResult {
  id: string;
  name: string;
  measure: MeasureField;
  generatedAt: number;
  /** Aggregate across every record that passed the filters. */
  summary: GroupStats;
  rows: ReportRow[];
  /** Records examined / included after filtering. */
  scanned: number;
  included: number;
}

type Predicate = (ev: SlaEvaluation) => boolean;

function readField(ev: SlaEvaluation, field: string): unknown {
  if (field in ev) return (ev as unknown as Record<string, unknown>)[field];
  return ev.dimensions?.[field] ?? null;
}

/** Compile filters into a single predicate closure (done once per report). */
function compileFilters(filters: ReportFilter[] | undefined): Predicate {
  if (!filters || filters.length === 0) return () => true;
  const compiled = filters.map(f => {
    const val = f.value;
    const set = f.op === 'in' && Array.isArray(val) ? new Set(val) : null;
    return (ev: SlaEvaluation): boolean => {
      const actual = readField(ev, f.field as string);
      switch (f.op) {
        case 'eq':
          return actual === val;
        case 'ne':
          return actual !== val;
        case 'gt':
          return (actual as number) > (val as number);
        case 'gte':
          return (actual as number) >= (val as number);
        case 'lt':
          return (actual as number) < (val as number);
        case 'lte':
          return (actual as number) <= (val as number);
        case 'in':
          return set!.has(actual);
        default:
          return true;
      }
    };
  });
  return ev => {
    for (let i = 0; i < compiled.length; i++) if (!compiled[i](ev)) return false;
    return true;
  };
}

/**
 * Build a report in a **single streaming pass** over `evaluations`.
 *
 * Accepts any iterable (array, generator, DB cursor adapter …) so callers can
 * stream records straight from a source without buffering them all in memory.
 * Grouping uses a flat `Map` keyed by a joined composite key; each group holds
 * one {@link GroupAccumulator} with O(1) memory. Nothing is sorted until the
 * (small) set of groups is finalised.
 */
export function buildReport(
  def: ReportDefinition,
  evaluations: Iterable<SlaEvaluation>,
): ReportResult {
  const measure = def.measure ?? 'elapsedSeconds';
  const quantiles = def.quantiles ?? [0.5, 0.9, 0.95];
  const groupBy = def.groupBy ?? [];
  const pass = compileFilters(def.filters);
  const bucket = def.bucket;

  const groups = new Map<string, {key: ReportRow['key']; acc: GroupAccumulator}>();
  const summary = new GroupAccumulator(quantiles);

  let scanned = 0;
  let included = 0;

  for (const ev of evaluations) {
    scanned++;
    if (!pass(ev)) continue;
    included++;

    const value = ev[measure];
    const isBreached = ev.status === 'breached';
    const isComplete = ev.met || ev.status === 'breached';
    summary.add(value, isBreached, isComplete);

    if (groupBy.length === 0 && !bucket) continue;

    const key: ReportRow['key'] = {};
    let composite = '';
    for (let i = 0; i < groupBy.length; i++) {
      const v = readField(ev, groupBy[i]) as string | number | boolean | null;
      key[groupBy[i]] = v;
      composite += (i ? '\u0001' : '') + String(v);
    }
    if (bucket) {
      const raw = ev[bucket.field];
      const b = typeof raw === 'number' ? Math.floor(raw / bucket.widthMs) * bucket.widthMs : null;
      key.__bucket = b;
      composite += '\u0001' + String(b);
    }

    let g = groups.get(composite);
    if (!g) {
      g = {key, acc: new GroupAccumulator(quantiles)};
      groups.set(composite, g);
    }
    g.acc.add(value, isBreached, isComplete);
  }

  let rows: ReportRow[] = [];
  for (const g of groups.values()) rows.push({key: g.key, stats: g.acc.toJSON()});

  if (def.sortBy) {
    const dir = def.sortDir === 'asc' ? 1 : -1;
    const field = def.sortBy;
    rows.sort((a, b) => ((a.stats[field] as number) - (b.stats[field] as number)) * dir);
  }
  if (def.limit !== undefined && def.limit >= 0) rows = rows.slice(0, def.limit);

  return {
    id: def.id,
    name: def.name ?? def.id,
    measure,
    generatedAt: Date.now(),
    summary: summary.toJSON(),
    rows,
    scanned,
    included,
  };
}
