import type {ReportResult, ReportRow} from '@crm/sla-engine';

/** A flat, grid-ready representation of a report (headers + rows of cells). */
export interface GridTable {
  columns: GridColumn[];
  rows: Array<Record<string, string | number | boolean | null>>;
}

export interface GridColumn {
  field: string;
  header: string;
  /** `dimension` columns come from the group key; `metric` from stats. */
  kind: 'dimension' | 'metric';
  numeric: boolean;
}

/**
 * Flatten a {@link ReportResult} into a table: one column per group dimension
 * plus one per computed metric (including each quantile), one row per group.
 * This single shape feeds both the on-screen grid and the CSV/Excel export.
 */
export function toGridTable(result: ReportResult): GridTable {
  const dimensionKeys = collectDimensionKeys(result.rows);
  const quantileKeys = collectQuantileKeys(result.rows);

  const columns: GridColumn[] = [
    ...dimensionKeys.map(
      (k): GridColumn => ({field: k, header: labelize(k), kind: 'dimension', numeric: false}),
    ),
    metricCol('count', 'Count'),
    metricCol('breached', 'Breached'),
    metricCol('met', 'Met'),
    metricCol('open', 'Open'),
    metricCol('breachRate', 'Breach %'),
    metricCol('attainment', 'Attainment %'),
    metricCol('avg', 'Avg'),
    metricCol('min', 'Min'),
    metricCol('max', 'Max'),
    ...quantileKeys.map((q): GridColumn => metricCol(`q_${q}`, q.toUpperCase())),
  ];

  const rows = result.rows.map(row => {
    const cell: Record<string, string | number | boolean | null> = {};
    for (const k of dimensionKeys) cell[k] = row.key[k] ?? null;
    cell['count'] = row.stats.count;
    cell['breached'] = row.stats.breached;
    cell['met'] = row.stats.met;
    cell['open'] = row.stats.open;
    cell['breachRate'] = pct(row.stats.breachRate);
    cell['attainment'] = pct(row.stats.attainment);
    cell['avg'] = row.stats.avg;
    cell['min'] = row.stats.min;
    cell['max'] = row.stats.max;
    for (const q of quantileKeys) cell[`q_${q}`] = row.stats.quantiles[q] ?? null;
    return cell;
  });

  return {columns, rows};
}

/** Serialise a {@link GridTable} to RFC-4180 CSV text. */
export function toCsv(table: GridTable): string {
  const header = table.columns.map(c => csvCell(c.header)).join(',');
  const body = table.rows
    .map(r => table.columns.map(c => csvCell(r[c.field])).join(','))
    .join('\r\n');
  return header + '\r\n' + body + '\r\n';
}

/**
 * Trigger a browser download of `content` as `filename`. No-ops outside a
 * browser (SSR-safe). Returns `true` if a download was initiated.
 */
export function downloadText(
  filename: string,
  content: string,
  mime = 'text/csv;charset=utf-8;',
): boolean {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return false;
  const blob = new Blob([content], {type: mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Release the object URL on the next tick so the download has time to start.
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
}

/** Download a report's grid directly as CSV. */
export function downloadReportCsv(result: ReportResult, filename?: string): boolean {
  const table = toGridTable(result);
  return downloadText(filename ?? `${result.id}.csv`, toCsv(table));
}

// --- helpers -------------------------------------------------------------

function metricCol(field: string, header: string): GridColumn {
  return {field, header, kind: 'metric', numeric: true};
}

function collectDimensionKeys(rows: ReportRow[]): string[] {
  const keys = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r.key)) keys.add(k);
  return [...keys];
}

function collectQuantileKeys(rows: ReportRow[]): string[] {
  const keys = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r.stats.quantiles)) keys.add(k);
  return [...keys].sort();
}

function pct(ratio: number): number {
  return Math.round(ratio * 1000) / 10; // one decimal place, as a percentage
}

function labelize(key: string): string {
  if (key === '__bucket') return 'Bucket';
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
