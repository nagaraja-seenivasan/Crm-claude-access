/*
 * Public API surface of @crm/sla-ui
 */

// Components (standalone)
export {SlaPolicyBuilderComponent} from './lib/components/sla-policy-builder/sla-policy-builder.component';
export {ReportBuilderComponent} from './lib/components/report-builder/report-builder.component';
export {SlaDashboardComponent} from './lib/components/sla-dashboard/sla-dashboard.component';
export {SlaGridReportComponent} from './lib/components/sla-grid-report/sla-grid-report.component';

// Optional aggregator module
export {SlaUiModule} from './lib/sla-ui.module';

// Services & utilities
export {SlaReportService} from './lib/services/sla-report.service';
export {
  toGridTable,
  toCsv,
  downloadText,
  downloadReportCsv,
} from './lib/services/csv-export.util';
export type {GridTable, GridColumn} from './lib/services/csv-export.util';

// Models & helpers
export {toSeconds, fromSeconds, formatDuration} from './lib/models/sla-ui.models';
export type {
  DimensionDef,
  NamedCalendar,
  DurationUnit,
  SavedReport,
  // re-exported engine types
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
} from './lib/models/sla-ui.models';
