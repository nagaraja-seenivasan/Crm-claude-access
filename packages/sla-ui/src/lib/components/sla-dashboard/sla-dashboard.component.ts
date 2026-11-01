import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, Input, computed, signal} from '@angular/core';
import type {ReportResult, ReportRow} from '@crm/sla-engine';
import {formatDuration} from '../../models/sla-ui.models';

interface Kpi {
  label: string;
  value: string;
  tone: 'neutral' | 'good' | 'warn' | 'bad';
  hint?: string;
}

interface BarRow {
  label: string;
  count: number;
  breachRate: number;
  attainment: number;
  avg: number;
  widthPct: number;
}

/**
 * A dashboard-style, read-only view of a {@link ReportResult}: KPI tiles, an
 * SLA-attainment gauge, and a per-group breakdown with inline bars. Pure
 * CSS/SVG — no charting dependency — so it drops into any Angular 17 app.
 */
@Component({
  selector: 'sla-dashboard',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./sla-dashboard.component.css'],
  template: `
    <section class="sla-dash" *ngIf="result() as r; else empty">
      <header class="sla-dash__head">
        <div>
          <h2 class="sla-dash__title">{{ r.name }}</h2>
          <p class="sla-dash__sub">
            {{ r.included | number }} of {{ r.scanned | number }} records ·
            generated {{ r.generatedAt | date: 'medium' }}
          </p>
        </div>
        <div class="sla-dash__gauge" [attr.aria-label]="'SLA attainment ' + attainmentPct() + '%'">
          <svg viewBox="0 0 120 120" width="96" height="96">
            <circle class="gauge-track" cx="60" cy="60" r="52"></circle>
            <circle
              class="gauge-value"
              [class.good]="attainmentTone() === 'good'"
              [class.warn]="attainmentTone() === 'warn'"
              [class.bad]="attainmentTone() === 'bad'"
              cx="60" cy="60" r="52"
              [attr.stroke-dasharray]="circumference"
              [attr.stroke-dashoffset]="gaugeOffset()"
              transform="rotate(-90 60 60)"></circle>
            <text x="60" y="58" class="gauge-num">{{ attainmentPct() }}%</text>
            <text x="60" y="76" class="gauge-cap">attainment</text>
          </svg>
        </div>
      </header>

      <div class="sla-dash__kpis">
        <div class="kpi kpi--{{ k.tone }}" *ngFor="let k of kpis()">
          <span class="kpi__value">{{ k.value }}</span>
          <span class="kpi__label">{{ k.label }}</span>
          <span class="kpi__hint" *ngIf="k.hint">{{ k.hint }}</span>
        </div>
      </div>

      <div class="sla-dash__breakdown" *ngIf="bars().length">
        <h3 class="sla-dash__section">Breakdown</h3>
        <div class="bar" *ngFor="let b of bars()">
          <div class="bar__label" [title]="b.label">{{ b.label }}</div>
          <div class="bar__track">
            <div
              class="bar__fill"
              [class.bad]="b.breachRate >= 0.25"
              [class.warn]="b.breachRate >= 0.1 && b.breachRate < 0.25"
              [style.width.%]="b.widthPct"></div>
          </div>
          <div class="bar__meta">
            <span>{{ b.count | number }}</span>
            <span class="bar__breach">{{ b.breachRate * 100 | number: '1.0-1' }}% breach</span>
            <span class="bar__avg">avg {{ fmt(b.avg) }}</span>
          </div>
        </div>
      </div>
    </section>

    <ng-template #empty>
      <div class="sla-dash sla-dash--empty">No report data.</div>
    </ng-template>
  `,
})
export class SlaDashboardComponent {
  readonly circumference = 2 * Math.PI * 52;
  private readonly _result = signal<ReportResult | null>(null);

  @Input() set report(value: ReportResult | null | undefined) {
    this._result.set(value ?? null);
  }

  /** Measure label shown on duration KPIs (e.g. "Resolution time"). */
  @Input() measureLabel = 'Duration';

  readonly result = computed(() => this._result());

  readonly attainmentPct = computed(() => {
    const r = this._result();
    return r ? Math.round(r.summary.attainment * 1000) / 10 : 0;
  });

  readonly attainmentTone = computed<'good' | 'warn' | 'bad'>(() => {
    const a = this.attainmentPct();
    if (a >= 95) return 'good';
    if (a >= 85) return 'warn';
    return 'bad';
  });

  gaugeOffset(): number {
    const pct = this.attainmentPct() / 100;
    return this.circumference * (1 - pct);
  }

  readonly kpis = computed<Kpi[]>(() => {
    const r = this._result();
    if (!r) return [];
    const s = r.summary;
    const q95 = s.quantiles['p95'];
    return [
      {label: 'Total', value: formatNum(s.count), tone: 'neutral'},
      {label: 'Breached', value: formatNum(s.breached), tone: s.breached ? 'bad' : 'good',
        hint: `${(s.breachRate * 100).toFixed(1)}% of total`},
      {label: 'Met', value: formatNum(s.met), tone: 'good'},
      {label: 'Open', value: formatNum(s.open), tone: s.open ? 'warn' : 'neutral'},
      {label: `Avg ${this.measureLabel}`, value: formatDuration(s.avg), tone: 'neutral'},
      ...(q95 !== undefined
        ? [{label: `P95 ${this.measureLabel}`, value: formatDuration(q95), tone: 'neutral' as const}]
        : []),
    ];
  });

  readonly bars = computed<BarRow[]>(() => {
    const r = this._result();
    if (!r) return [];
    const max = r.rows.reduce((m, row) => Math.max(m, row.stats.count), 1);
    return r.rows.map(row => ({
      label: keyLabel(row),
      count: row.stats.count,
      breachRate: row.stats.breachRate,
      attainment: row.stats.attainment,
      avg: row.stats.avg,
      widthPct: Math.max(2, (row.stats.count / max) * 100),
    }));
  });

  fmt(seconds: number): string {
    return formatDuration(seconds);
  }
}

function formatNum(n: number): string {
  return n.toLocaleString();
}

function keyLabel(row: ReportRow): string {
  const parts = Object.entries(row.key).map(([k, v]) =>
    k === '__bucket' && typeof v === 'number' ? new Date(v).toLocaleDateString() : String(v),
  );
  return parts.join(' · ') || 'All';
}
