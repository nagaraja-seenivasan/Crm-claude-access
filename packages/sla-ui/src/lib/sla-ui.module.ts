import {NgModule} from '@angular/core';
import {SlaPolicyBuilderComponent} from './components/sla-policy-builder/sla-policy-builder.component';
import {ReportBuilderComponent} from './components/report-builder/report-builder.component';
import {SlaDashboardComponent} from './components/sla-dashboard/sla-dashboard.component';
import {SlaGridReportComponent} from './components/sla-grid-report/sla-grid-report.component';

const COMPONENTS = [
  SlaPolicyBuilderComponent,
  ReportBuilderComponent,
  SlaDashboardComponent,
  SlaGridReportComponent,
];

/**
 * Convenience module for consumers that are not yet using standalone
 * components. Since every component here is standalone, it is imported (not
 * declared) and simply re-exported. Standalone apps can import the components
 * directly instead of this module.
 */
@NgModule({
  imports: COMPONENTS,
  exports: COMPONENTS,
})
export class SlaUiModule {}
