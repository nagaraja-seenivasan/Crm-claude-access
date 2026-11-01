# @crm/sla-ui

An **Angular 17+** component library for SLA management:

- **`<sla-policy-builder>`** — SLA setup: author business calendars and policies
  with priority-based target rules.
- **`<sla-report-builder>`** — interactive builder that produces a reusable
  `ReportDefinition` (group-by, measure, percentiles, filters, sort, limit,
  daily-trend bucketing).
- **`<sla-dashboard>`** — a dashboard-style report: KPI tiles, an attainment
  gauge, and a per-group breakdown. Pure CSS/SVG, no charting dependency.
- **`<sla-grid-report>`** — a downloadable gridview report: sortable, filterable
  table with one-click **CSV export** that matches the on-screen view.

All components are **standalone**, `OnPush`, light/dark aware, and responsive.
Computation is delegated to [`@crm/sla-engine`](../sla-engine) via
`SlaReportService`, so a single `ReportDefinition` drives both the dashboard and
the grid.

## Install

```bash
npm install @crm/sla-ui @crm/sla-engine
```

Peer dependencies: `@angular/common`, `@angular/core`, `@angular/forms` (17–18),
and `@crm/sla-engine`.

## Build

```bash
npm install
npm run build        # ng-packagr -> dist/
```

## Usage

A full SLA reporting page — setup → build → view (dashboard + downloadable grid):

```ts
import {Component, signal} from '@angular/core';
import {
  SlaPolicyBuilderComponent,
  ReportBuilderComponent,
  SlaDashboardComponent,
  SlaGridReportComponent,
  SlaReportService,
  type DimensionDef,
  type NamedCalendar,
  type ReportDefinition,
  type ReportResult,
  type SlaInstance,
  type SlaPolicyConfig,
} from '@crm/sla-ui';

@Component({
  standalone: true,
  selector: 'app-sla-page',
  imports: [
    SlaPolicyBuilderComponent,
    ReportBuilderComponent,
    SlaDashboardComponent,
    SlaGridReportComponent,
  ],
  template: `
    <sla-policy-builder
      (calendarsChange)="onCalendars($event)"
      (policiesChange)="onPolicies($event)">
    </sla-policy-builder>

    <sla-report-builder
      [dimensions]="dimensions"
      (run)="run($event)">
    </sla-report-builder>

    <div class="view-toggle">
      <button (click)="view.set('dashboard')">Dashboard</button>
      <button (click)="view.set('grid')">Grid</button>
    </div>

    <sla-dashboard   *ngIf="view() === 'dashboard'" [report]="result()" measureLabel="Resolution"></sla-dashboard>
    <sla-grid-report *ngIf="view() === 'grid'"      [report]="result()"></sla-grid-report>
  `,
})
export class SlaPageComponent {
  readonly view = signal<'dashboard' | 'grid'>('dashboard');
  readonly result = signal<ReportResult | null>(null);

  dimensions: DimensionDef[] = [
    {key: 'team', label: 'Team'},
    {key: 'priority', label: 'Priority', values: ['low', 'high', 'urgent']},
    {key: 'channel', label: 'Channel'},
  ];

  instances: SlaInstance[] = [];           // load from your API

  constructor(private sla: SlaReportService) {}

  onCalendars(cals: NamedCalendar[]) {
    for (const c of cals) this.sla.addCalendar(c.id, c.config);
  }
  onPolicies(policies: SlaPolicyConfig[]) {
    for (const p of policies) this.sla.addPolicy(p);
  }
  run(def: ReportDefinition) {
    this.result.set(this.sla.report(def, this.instances));
  }
}
```

### NgModule consumers

Every component is standalone; a convenience `SlaUiModule` re-exports all four
for apps not yet on standalone APIs:

```ts
import {SlaUiModule} from '@crm/sla-ui';

@NgModule({imports: [SlaUiModule]})
export class ReportingModule {}
```

## Components

### `<sla-policy-builder>`
| | |
| --- | --- |
| `@Input() initialCalendars: NamedCalendar[]` | seed the calendar editors |
| `@Input() initialPolicies: SlaPolicyConfig[]` | seed the policy editors |
| `@Output() calendarsChange: NamedCalendar[]` | emitted on every edit |
| `@Output() policiesChange: SlaPolicyConfig[]` | emitted on every edit |

### `<sla-report-builder>`
| | |
| --- | --- |
| `@Input() dimensions: DimensionDef[]` | group-by / filter options |
| `@Input() definition: ReportDefinition` | seed from a saved report |
| `@Output() definitionChange: ReportDefinition` | emitted on every edit |
| `@Output() run: ReportDefinition` | emitted on "Run report" |

### `<sla-dashboard>`
| | |
| --- | --- |
| `@Input() report: ReportResult` | the report to visualise |
| `@Input() measureLabel: string` | label for duration KPIs |

### `<sla-grid-report>`
| | |
| --- | --- |
| `@Input() report: ReportResult` | the report to tabulate |
| `@Input() filename?: string` | CSV download filename |

The grid's **Download CSV** honours the active sort and filter, so the export
always matches what is on screen. `downloadReportCsv(result)` is also exported
for programmatic exports.

## Theming

Each component exposes CSS custom properties (`--sla-accent`, `--sla-good`,
`--sla-warn`, `--sla-bad`, `--sla-surface`, `--sla-border`, …) on its host, with
a built-in `prefers-color-scheme: dark` fallback. Override them from your app to
match your brand.

## License

MIT
