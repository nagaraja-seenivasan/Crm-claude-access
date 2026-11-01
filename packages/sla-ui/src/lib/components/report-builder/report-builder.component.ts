import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import type {
  MeasureField,
  ReportDefinition,
  ReportFilter,
} from '@crm/sla-engine';
import type {DimensionDef} from '../../models/sla-ui.models';

type FilterOp = ReportFilter['op'];

interface FilterDraft {
  field: string;
  op: FilterOp;
  value: string;
}

const MEASURES: Array<{value: MeasureField; label: string}> = [
  {value: 'elapsedSeconds', label: 'Elapsed time'},
  {value: 'remainingSeconds', label: 'Remaining time'},
  {value: 'consumedRatio', label: 'Budget consumed (ratio)'},
];

const QUANTILE_CHOICES = [
  {p: 0.5, label: 'P50'},
  {p: 0.9, label: 'P90'},
  {p: 0.95, label: 'P95'},
  {p: 0.99, label: 'P99'},
];

const STATUS_VALUES = ['pending', 'running', 'paused', 'met', 'breached', 'cancelled'];

/**
 * Interactive builder that produces a {@link ReportDefinition}. The same
 * definition drives both the dashboard and the grid view, so a user designs a
 * report once and switches presentation freely.
 *
 * Emits `definitionChange` on every edit and `run` when the user asks to
 * execute the report.
 */
@Component({
  selector: 'sla-report-builder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./report-builder.component.css'],
  template: `
    <section class="rb">
      <header class="rb__head">
        <h2 class="rb__title">Report builder</h2>
        <button type="button" class="rb__run" (click)="emitRun()">Run report ▶</button>
      </header>

      <div class="rb__grid">
        <label class="rb__field rb__field--wide">
          <span>Report name</span>
          <input type="text" [(ngModel)]="name" (ngModelChange)="emit()" placeholder="e.g. Breach by team" />
        </label>

        <label class="rb__field">
          <span>Measure</span>
          <select [(ngModel)]="measure" (ngModelChange)="emit()">
            <option *ngFor="let m of measures" [value]="m.value">{{ m.label }}</option>
          </select>
        </label>

        <label class="rb__field">
          <span>Row limit</span>
          <input type="number" min="0" [(ngModel)]="limit" (ngModelChange)="emit()" placeholder="All" />
        </label>
      </div>

      <fieldset class="rb__set">
        <legend>Group by</legend>
        <p class="rb__hint" *ngIf="!dimensions.length">No dimensions configured.</p>
        <label class="rb__chip" *ngFor="let d of dimensions">
          <input type="checkbox" [checked]="groupBy.includes(d.key)" (change)="toggleGroup(d.key)" />
          {{ d.label }}
        </label>
      </fieldset>

      <fieldset class="rb__set">
        <legend>Percentiles</legend>
        <label class="rb__chip" *ngFor="let q of quantileChoices">
          <input type="checkbox" [checked]="quantiles.includes(q.p)" (change)="toggleQuantile(q.p)" />
          {{ q.label }}
        </label>
      </fieldset>

      <fieldset class="rb__set">
        <legend>Filters</legend>
        <div class="rb__filter" *ngFor="let f of filters; let i = index">
          <select [(ngModel)]="f.field" (ngModelChange)="emit()">
            <option value="status">status</option>
            <option *ngFor="let d of dimensions" [value]="d.key">{{ d.label }}</option>
          </select>
          <select [(ngModel)]="f.op" (ngModelChange)="emit()">
            <option *ngFor="let op of ops" [value]="op">{{ op }}</option>
          </select>
          <ng-container [ngSwitch]="f.field === 'status'">
            <select *ngSwitchCase="true" [(ngModel)]="f.value" (ngModelChange)="emit()">
              <option *ngFor="let s of statusValues" [value]="s">{{ s }}</option>
            </select>
            <input *ngSwitchDefault type="text" [(ngModel)]="f.value" (ngModelChange)="emit()" placeholder="value" />
          </ng-container>
          <button type="button" class="rb__icon" (click)="removeFilter(i)" aria-label="Remove filter">✕</button>
        </div>
        <button type="button" class="rb__add" (click)="addFilter()">+ Add filter</button>
      </fieldset>

      <div class="rb__grid">
        <label class="rb__field">
          <span>Sort by</span>
          <select [(ngModel)]="sortBy" (ngModelChange)="emit()">
            <option value="">—</option>
            <option value="count">Count</option>
            <option value="breached">Breached</option>
            <option value="breachRate">Breach %</option>
            <option value="attainment">Attainment %</option>
            <option value="avg">Average</option>
          </select>
        </label>
        <label class="rb__field">
          <span>Direction</span>
          <select [(ngModel)]="sortDir" (ngModelChange)="emit()">
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </label>
        <label class="rb__field rb__field--check">
          <input type="checkbox" [(ngModel)]="dailyTrend" (ngModelChange)="emit()" />
          <span>Daily trend (bucket by breach date)</span>
        </label>
      </div>
    </section>
  `,
})
export class ReportBuilderComponent {
  @Input() dimensions: DimensionDef[] = [];

  /** Seed the builder from an existing definition. */
  @Input() set definition(def: ReportDefinition | null | undefined) {
    if (!def) return;
    this.name = def.name ?? def.id;
    this.measure = def.measure ?? 'elapsedSeconds';
    this.groupBy = [...(def.groupBy ?? [])];
    this.quantiles = [...(def.quantiles ?? [0.5, 0.9, 0.95])];
    this.filters = (def.filters ?? []).map(f => ({field: f.field as string, op: f.op, value: String(f.value)}));
    this.sortBy = (def.sortBy as string) ?? '';
    this.sortDir = def.sortDir ?? 'desc';
    this.limit = def.limit ?? null;
    this.dailyTrend = def.bucket?.field === 'breachedAt';
  }

  @Output() definitionChange = new EventEmitter<ReportDefinition>();
  @Output() run = new EventEmitter<ReportDefinition>();

  readonly measures = MEASURES;
  readonly quantileChoices = QUANTILE_CHOICES;
  readonly statusValues = STATUS_VALUES;
  readonly ops: FilterOp[] = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in'];

  name = 'SLA report';
  measure: MeasureField = 'elapsedSeconds';
  groupBy: string[] = [];
  quantiles: number[] = [0.5, 0.9, 0.95];
  filters: FilterDraft[] = [];
  sortBy = 'breachRate';
  sortDir: 'asc' | 'desc' = 'desc';
  limit: number | null = null;
  dailyTrend = false;

  toggleGroup(key: string): void {
    this.groupBy = this.groupBy.includes(key)
      ? this.groupBy.filter(k => k !== key)
      : [...this.groupBy, key];
    this.emit();
  }

  toggleQuantile(p: number): void {
    this.quantiles = this.quantiles.includes(p)
      ? this.quantiles.filter(q => q !== p)
      : [...this.quantiles, p].sort((a, b) => a - b);
    this.emit();
  }

  addFilter(): void {
    this.filters = [...this.filters, {field: 'status', op: 'eq', value: 'breached'}];
    this.emit();
  }

  removeFilter(i: number): void {
    this.filters = this.filters.filter((_, idx) => idx !== i);
    this.emit();
  }

  /** Build the current definition from form state. */
  build(): ReportDefinition {
    const def: ReportDefinition = {
      id: slug(this.name),
      name: this.name,
      measure: this.measure,
      groupBy: [...this.groupBy],
      quantiles: [...this.quantiles],
    };
    if (this.filters.length) {
      def.filters = this.filters.map(f => ({field: f.field, op: f.op, value: coerce(f.op, f.value)}));
    }
    if (this.sortBy) {
      def.sortBy = this.sortBy as ReportDefinition['sortBy'];
      def.sortDir = this.sortDir;
    }
    if (this.limit !== null && this.limit >= 0) def.limit = Number(this.limit);
    if (this.dailyTrend) def.bucket = {field: 'breachedAt', widthMs: 86_400_000};
    return def;
  }

  emit(): void {
    this.definitionChange.emit(this.build());
  }

  emitRun(): void {
    const def = this.build();
    this.definitionChange.emit(def);
    this.run.emit(def);
  }
}

function slug(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'report';
}

/** Coerce the string input to the appropriate type for the operator. */
function coerce(op: FilterOp, raw: string): unknown {
  if (op === 'in') return raw.split(',').map(v => numericOrString(v.trim()));
  if (op === 'gt' || op === 'gte' || op === 'lt' || op === 'lte') return Number(raw);
  return numericOrString(raw);
}

function numericOrString(v: string): string | number | boolean {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v !== '' && !isNaN(Number(v))) return Number(v);
  return v;
}
