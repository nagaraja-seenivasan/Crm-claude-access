# SLA packages

Two complementary, independently publishable libraries for Service Level
Agreement tracking and reporting.

| Package | Stack | Purpose |
| --- | --- | --- |
| [`@crm/sla-engine`](./sla-engine) | Node.js / TypeScript (zero deps) | High-performance SLA computation + report-optimized streaming aggregation. ~1M instances/s. |
| [`@crm/sla-ui`](./sla-ui) | Angular 17+ | SLA setup, report builder, dashboard report, and downloadable gridview report. |

## How they fit together

```
          ┌─────────────────────────── @crm/sla-ui (Angular) ───────────────────────────┐
          │                                                                              │
  <sla-policy-builder> ──policies/calendars──▶ SlaReportService ──┐                       │
  <sla-report-builder> ──ReportDefinition─────────────────────────┤                       │
          │                                                        ▼                       │
          │                                              @crm/sla-engine                   │
          │                                        (evaluate + streaming report)           │
          │                                                        │                       │
          │                              ReportResult ◀────────────┘                       │
          │                                   │                                            │
          │              ┌────────────────────┴────────────────────┐                      │
          │       <sla-dashboard>                          <sla-grid-report> ──▶ CSV export │
          └──────────────────────────────────────────────────────────────────────────────┘
```

A single `ReportDefinition` built in the UI powers both the dashboard view and
the downloadable grid — design once, present either way.

## Develop

Each package is self-contained:

```bash
# Node SLA engine
cd packages/sla-engine && npm install && npm test && npm run bench

# Angular component library
cd packages/sla-ui && npm install && npm run build
```

`@crm/sla-ui` depends on `@crm/sla-engine`; during local development it resolves
the engine via `file:../sla-engine`. Build the engine first (`npm run build` in
`sla-engine`) so its `dist/` types are available.

Both are MIT licensed.
