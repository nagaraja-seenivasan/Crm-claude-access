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
  BusinessCalendarConfig,
  SlaPolicyConfig,
  Weekday,
} from '@crm/sla-engine';
import {
  DurationUnit,
  NamedCalendar,
  fromSeconds,
  toSeconds,
} from '../../models/sla-ui.models';

interface RuleDraft {
  dimension: string;
  dimValue: string;
  targetValue: number;
  targetUnit: DurationUnit;
  priority: number;
}

interface PolicyDraft {
  id: string;
  name: string;
  metric: string;
  calendarId: string;
  defaultValue: number;
  defaultUnit: DurationUnit;
  rules: RuleDraft[];
}

interface DayDraft {
  weekday: Weekday;
  label: string;
  enabled: boolean;
  start: string; // HH:MM
  end: string; // HH:MM
}

interface CalendarDraft {
  id: string;
  name: string;
  continuous: boolean;
  offsetMinutes: number;
  days: DayDraft[];
  holidays: string; // comma/newline separated YYYY-MM-DD
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * SLA setup: author business calendars and policies, including priority-based
 * target rules. Emits `policiesChange` (`SlaPolicyConfig[]`) and
 * `calendarsChange` (`NamedCalendar[]`) — the exact shapes the engine and
 * {@link SlaReportService} consume, so output can be persisted and replayed.
 */
@Component({
  selector: 'sla-policy-builder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./sla-policy-builder.component.css'],
  template: `
    <section class="pb">
      <!-- Calendars -->
      <div class="pb__panel">
        <header class="pb__panelhead">
          <h3>Business calendars</h3>
          <button type="button" class="pb__add" (click)="addCalendar()">+ Calendar</button>
        </header>

        <article class="pb__card" *ngFor="let c of calendars; let ci = index">
          <div class="pb__row">
            <label class="pb__f"><span>Id</span>
              <input type="text" [(ngModel)]="c.id" (ngModelChange)="emitCalendars()" /></label>
            <label class="pb__f"><span>Name</span>
              <input type="text" [(ngModel)]="c.name" (ngModelChange)="emitCalendars()" /></label>
            <label class="pb__f"><span>UTC offset (min)</span>
              <input type="number" [(ngModel)]="c.offsetMinutes" (ngModelChange)="emitCalendars()" /></label>
            <label class="pb__f pb__f--check">
              <input type="checkbox" [(ngModel)]="c.continuous" (ngModelChange)="emitCalendars()" />
              <span>24×7</span>
            </label>
            <button type="button" class="pb__del" (click)="removeCalendar(ci)">Remove</button>
          </div>

          <div class="pb__days" *ngIf="!c.continuous">
            <div class="pb__day" *ngFor="let d of c.days">
              <label class="pb__daytoggle">
                <input type="checkbox" [(ngModel)]="d.enabled" (ngModelChange)="emitCalendars()" />
                {{ d.label }}
              </label>
              <input type="time" [(ngModel)]="d.start" [disabled]="!d.enabled" (ngModelChange)="emitCalendars()" />
              <span>–</span>
              <input type="time" [(ngModel)]="d.end" [disabled]="!d.enabled" (ngModelChange)="emitCalendars()" />
            </div>
          </div>

          <label class="pb__f pb__f--wide" *ngIf="!c.continuous">
            <span>Holidays (YYYY-MM-DD, comma separated)</span>
            <input type="text" [(ngModel)]="c.holidays" (ngModelChange)="emitCalendars()"
                   placeholder="2026-01-01, 2026-12-25" />
          </label>
        </article>
      </div>

      <!-- Policies -->
      <div class="pb__panel">
        <header class="pb__panelhead">
          <h3>SLA policies</h3>
          <button type="button" class="pb__add" (click)="addPolicy()">+ Policy</button>
        </header>

        <article class="pb__card" *ngFor="let p of policies; let pi = index">
          <div class="pb__row">
            <label class="pb__f"><span>Id</span>
              <input type="text" [(ngModel)]="p.id" (ngModelChange)="emitPolicies()" /></label>
            <label class="pb__f"><span>Name</span>
              <input type="text" [(ngModel)]="p.name" (ngModelChange)="emitPolicies()" /></label>
            <label class="pb__f"><span>Metric</span>
              <input type="text" [(ngModel)]="p.metric" (ngModelChange)="emitPolicies()"
                     placeholder="resolution" /></label>
            <label class="pb__f"><span>Calendar</span>
              <select [(ngModel)]="p.calendarId" (ngModelChange)="emitPolicies()">
                <option *ngFor="let c of calendars" [value]="c.id">{{ c.name || c.id }}</option>
              </select></label>
            <button type="button" class="pb__del" (click)="removePolicy(pi)">Remove</button>
          </div>

          <div class="pb__row pb__row--target">
            <span class="pb__tlabel">Default target</span>
            <input type="number" min="0" [(ngModel)]="p.defaultValue" (ngModelChange)="emitPolicies()" />
            <select [(ngModel)]="p.defaultUnit" (ngModelChange)="emitPolicies()">
              <option *ngFor="let u of units" [value]="u">{{ u }}</option>
            </select>
          </div>

          <div class="pb__rules">
            <h4 class="pb__rulestitle">Priority rules</h4>
            <div class="pb__rule" *ngFor="let r of p.rules; let ri = index">
              <span class="pb__when">when</span>
              <input class="pb__rdim" type="text" [(ngModel)]="r.dimension" (ngModelChange)="emitPolicies()"
                     placeholder="priority" />
              <span class="pb__eq">=</span>
              <input class="pb__rval" type="text" [(ngModel)]="r.dimValue" (ngModelChange)="emitPolicies()"
                     placeholder="high" />
              <span class="pb__then">→</span>
              <input class="pb__rtarget" type="number" min="0" [(ngModel)]="r.targetValue"
                     (ngModelChange)="emitPolicies()" />
              <select [(ngModel)]="r.targetUnit" (ngModelChange)="emitPolicies()">
                <option *ngFor="let u of units" [value]="u">{{ u }}</option>
              </select>
              <label class="pb__prio">prio
                <input type="number" [(ngModel)]="r.priority" (ngModelChange)="emitPolicies()" />
              </label>
              <button type="button" class="pb__icon" (click)="removeRule(p, ri)" aria-label="Remove rule">✕</button>
            </div>
            <button type="button" class="pb__add pb__add--sm" (click)="addRule(p)">+ Add rule</button>
          </div>
        </article>
      </div>
    </section>
  `,
})
export class SlaPolicyBuilderComponent {
  readonly units: DurationUnit[] = ['minutes', 'hours', 'days', 'seconds'];

  calendars: CalendarDraft[] = [defaultCalendarDraft()];
  policies: PolicyDraft[] = [];

  /** Seed calendars from persisted {@link NamedCalendar}s. */
  @Input() set initialCalendars(cals: NamedCalendar[] | null | undefined) {
    if (cals && cals.length) this.calendars = cals.map(fromNamedCalendar);
  }

  /** Seed policies from persisted {@link SlaPolicyConfig}s. */
  @Input() set initialPolicies(policies: SlaPolicyConfig[] | null | undefined) {
    if (policies && policies.length) this.policies = policies.map(fromPolicyConfig);
  }

  @Output() policiesChange = new EventEmitter<SlaPolicyConfig[]>();
  @Output() calendarsChange = new EventEmitter<NamedCalendar[]>();

  // --- calendar actions ---
  addCalendar(): void {
    const n = this.calendars.length + 1;
    this.calendars = [...this.calendars, {...defaultCalendarDraft(), id: `cal-${n}`, name: `Calendar ${n}`}];
    this.emitCalendars();
  }
  removeCalendar(i: number): void {
    this.calendars = this.calendars.filter((_, idx) => idx !== i);
    this.emitCalendars();
  }

  // --- policy actions ---
  addPolicy(): void {
    const n = this.policies.length + 1;
    this.policies = [
      ...this.policies,
      {
        id: `policy-${n}`,
        name: `Policy ${n}`,
        metric: 'resolution',
        calendarId: this.calendars[0]?.id ?? 'default',
        defaultValue: 8,
        defaultUnit: 'hours',
        rules: [],
      },
    ];
    this.emitPolicies();
  }
  removePolicy(i: number): void {
    this.policies = this.policies.filter((_, idx) => idx !== i);
    this.emitPolicies();
  }
  addRule(p: PolicyDraft): void {
    p.rules = [...p.rules, {dimension: 'priority', dimValue: 'high', targetValue: 4, targetUnit: 'hours', priority: 10}];
    this.emitPolicies();
  }
  removeRule(p: PolicyDraft, i: number): void {
    p.rules = p.rules.filter((_, idx) => idx !== i);
    this.emitPolicies();
  }

  // --- emit as engine-ready config ---
  emitPolicies(): void {
    this.policiesChange.emit(this.policies.map(toPolicyConfig));
  }
  emitCalendars(): void {
    this.calendarsChange.emit(this.calendars.map(toNamedCalendar));
  }

  /** Current configuration snapshot (both calendars and policies). */
  snapshot(): {calendars: NamedCalendar[]; policies: SlaPolicyConfig[]} {
    return {
      calendars: this.calendars.map(toNamedCalendar),
      policies: this.policies.map(toPolicyConfig),
    };
  }
}

// --- mapping helpers -----------------------------------------------------

function defaultDays(): DayDraft[] {
  return WEEKDAY_LABELS.map((label, i) => ({
    weekday: i as Weekday,
    label,
    enabled: i >= 1 && i <= 5,
    start: '09:00',
    end: '17:00',
  }));
}

function defaultCalendarDraft(): CalendarDraft {
  return {id: 'default', name: 'Default (Mon–Fri 9–5)', continuous: false, offsetMinutes: 0, days: defaultDays(), holidays: ''};
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function toNamedCalendar(c: CalendarDraft): NamedCalendar {
  const config: BusinessCalendarConfig = {timeZoneOffsetMinutes: c.offsetMinutes};
  if (c.continuous) {
    config.continuous = true;
  } else {
    const week: BusinessCalendarConfig['week'] = {};
    for (const d of c.days) {
      if (d.enabled) week![d.weekday] = [{start: hhmmToMinutes(d.start), end: hhmmToMinutes(d.end)}];
    }
    config.week = week;
    const holidays = c.holidays
      .split(/[,\n]/)
      .map(s => s.trim())
      .filter(Boolean);
    if (holidays.length) config.holidays = holidays;
  }
  return {id: c.id, name: c.name, config};
}

function fromNamedCalendar(c: NamedCalendar): CalendarDraft {
  const days = defaultDays().map(d => ({...d, enabled: false}));
  const week = c.config.week;
  if (week) {
    for (const d of days) {
      const iv = week[d.weekday]?.[0];
      if (iv) {
        d.enabled = true;
        d.start = minutesToHHMM(iv.start);
        d.end = minutesToHHMM(iv.end);
      }
    }
  }
  return {
    id: c.id,
    name: c.name,
    continuous: c.config.continuous === true,
    offsetMinutes: c.config.timeZoneOffsetMinutes ?? 0,
    days,
    holidays: (c.config.holidays ?? []).map(String).join(', '),
  };
}

function toPolicyConfig(p: PolicyDraft): SlaPolicyConfig {
  return {
    id: p.id,
    name: p.name,
    metric: p.metric,
    calendarId: p.calendarId,
    defaultTargetSeconds: toSeconds(p.defaultValue, p.defaultUnit),
    rules: p.rules.map(r => ({
      when: {[r.dimension]: numericOrString(r.dimValue)},
      targetSeconds: toSeconds(r.targetValue, r.targetUnit),
      priority: r.priority,
    })),
  };
}

function fromPolicyConfig(p: SlaPolicyConfig): PolicyDraft {
  const def = fromSeconds(p.defaultTargetSeconds);
  return {
    id: p.id,
    name: p.name ?? p.id,
    metric: p.metric,
    calendarId: p.calendarId ?? 'default',
    defaultValue: def.value,
    defaultUnit: def.unit,
    rules: (p.rules ?? []).map(r => {
      const t = fromSeconds(r.targetSeconds);
      const [dim, val] = Object.entries(r.when ?? {})[0] ?? ['priority', ''];
      return {dimension: dim, dimValue: String(val), targetValue: t.value, targetUnit: t.unit, priority: r.priority ?? 0};
    }),
  };
}

function numericOrString(v: string): string | number | boolean {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v !== '' && !isNaN(Number(v))) return Number(v);
  return v;
}
