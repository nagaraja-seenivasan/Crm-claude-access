import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, Input, computed, signal} from '@angular/core';
import type {ReportResult} from '@crm/sla-engine';
import {
  GridColumn,
  GridTable,
  downloadText,
  toCsv,
  toGridTable,
} from '../../services/csv-export.util';

type SortDir = 'asc' | 'desc';

/**
 * A downloadable grid view of a {@link ReportResult}. Renders one row per group
 * with sortable columns and a one-click CSV export. The grid and the export are
 * produced from the same {@link GridTable} flattening, so what you see is
 * exactly what you download.
 */
@Component({
  selector: 'sla-grid-report',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./sla-grid-report.component.css'],
  template: `
    <section class="sla-grid" *ngIf="table() as t; else empty">
      <header class="sla-grid__head">
        <div>
          <h2 class="sla-grid__title">{{ title() }}</h2>
          <p class="sla-grid__sub">{{ t.rows.length | number }} rows</p>
        </div>
        <div class="sla-grid__actions">
          <input
            class="sla-grid__filter"
            type="search"
            placeholder="Filter rows…"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
            aria-label="Filter rows" />
          <button type="button" class="sla-grid__btn" (click)="downloadCsv()">
            ⬇ Download CSV
          </button>
        </div>
      </header>

      <div class="sla-grid__scroll">
        <table class="sla-grid__table">
          <thead>
            <tr>
              <th
                *ngFor="let c of t.columns"
                [class.numeric]="c.numeric"
                [class.sorted]="sortField() === c.field"
                (click)="sort(c)">
                {{ c.header }}
                <span class="sla-grid__sortcue" *ngIf="sortField() === c.field">
                  {{ sortDir() === 'asc' ? '▲' : '▼' }}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of visibleRows()">
              <td *ngFor="let c of t.columns" [class.numeric]="c.numeric">
                {{ display(row[c.field], c) }}
              </td>
            </tr>
            <tr *ngIf="!visibleRows().length">
              <td class="sla-grid__none" [attr.colspan]="t.columns.length">No matching rows.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <ng-template #empty>
      <div class="sla-grid sla-grid--empty">No report data.</div>
    </ng-template>
  `,
})
export class SlaGridReportComponent {
  private readonly _result = signal<ReportResult | null>(null);
  readonly query = signal('');
  readonly sortField = signal<string | null>(null);
  readonly sortDir = signal<SortDir>('desc');

  @Input() set report(value: ReportResult | null | undefined) {
    this._result.set(value ?? null);
  }

  /** Optional override for the download filename (defaults to `<id>.csv`). */
  @Input() filename?: string;

  readonly table = computed<GridTable | null>(() => {
    const r = this._result();
    return r ? toGridTable(r) : null;
  });

  readonly title = computed(() => this._result()?.name ?? 'Report');

  readonly visibleRows = computed(() => {
    const t = this.table();
    if (!t) return [];
    const q = this.query().trim().toLowerCase();
    let rows = t.rows;
    if (q) {
      rows = rows.filter(row =>
        t.columns.some(c => String(row[c.field] ?? '').toLowerCase().includes(q)),
      );
    }
    const field = this.sortField();
    if (field) {
      const dir = this.sortDir() === 'asc' ? 1 : -1;
      rows = [...rows].sort((a, b) => compare(a[field], b[field]) * dir);
    }
    return rows;
  });

  sort(col: GridColumn): void {
    if (this.sortField() === col.field) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(col.field);
      this.sortDir.set(col.numeric ? 'desc' : 'asc');
    }
  }

  downloadCsv(): void {
    const r = this._result();
    const t = this.table();
    if (!r || !t) return;
    // Export honours the current sort/filter so the file matches the view.
    const exportTable: GridTable = {columns: t.columns, rows: this.visibleRows()};
    downloadText(this.filename ?? `${r.id}.csv`, toCsv(exportTable));
  }

  display(value: unknown, col: GridColumn): string {
    if (value === null || value === undefined) return '—';
    if (col.field === '__bucket' && typeof value === 'number') {
      return new Date(value).toLocaleDateString();
    }
    if (col.numeric && typeof value === 'number') {
      return value.toLocaleString(undefined, {maximumFractionDigits: 2});
    }
    return String(value);
  }
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a ?? '').localeCompare(String(b ?? ''));
}
