import {Injectable} from '@angular/core';
import {
  SlaEngine,
  type BusinessCalendarConfig,
  type ReportDefinition,
  type ReportResult,
  type SlaEvaluation,
  type SlaInstance,
  type SlaPolicyConfig,
} from '@crm/sla-engine';

/**
 * Thin Angular facade over {@link SlaEngine}. Register calendars and policies
 * once (e.g. from your API), then compute dashboard / grid reports entirely in
 * the browser — the engine's streaming aggregation keeps this cheap even for
 * tens of thousands of rows.
 *
 * Provided in root by default; override in a feature module if you need an
 * isolated engine instance.
 */
@Injectable({providedIn: 'root'})
export class SlaReportService {
  private engine = new SlaEngine();

  /** Replace all calendars and policies in one shot (idempotent setup). */
  configure(options: {
    calendars?: Array<{id: string; config: BusinessCalendarConfig}>;
    policies?: SlaPolicyConfig[];
  }): void {
    this.engine = new SlaEngine();
    for (const c of options.calendars ?? []) this.engine.addCalendar(c.id, c.config);
    for (const p of options.policies ?? []) this.engine.addPolicy(p);
  }

  addCalendar(id: string, config: BusinessCalendarConfig): void {
    this.engine.addCalendar(id, config);
  }

  addPolicy(config: SlaPolicyConfig): void {
    this.engine.addPolicy(config);
  }

  /** Evaluate a single instance at `now`. */
  evaluate(instance: SlaInstance, now: number = Date.now()): SlaEvaluation {
    return this.engine.evaluate(instance, now);
  }

  /** Evaluate many instances (array) at `now`. */
  evaluateAll(instances: Iterable<SlaInstance>, now: number = Date.now()): SlaEvaluation[] {
    return [...this.engine.evaluateMany(instances, now)];
  }

  /**
   * Build a report straight from instances in a single streaming pass. Use this
   * for both dashboard and grid views — they share one definition.
   */
  report(def: ReportDefinition, instances: Iterable<SlaInstance>, now = Date.now()): ReportResult {
    return this.engine.report(def, instances, now);
  }

  /** Build a report from pre-computed evaluations (e.g. fetched from an API). */
  reportFromEvaluations(def: ReportDefinition, evaluations: Iterable<SlaEvaluation>): ReportResult {
    return this.engine.reportFromEvaluations(def, evaluations);
  }

  /** The underlying engine, for advanced use. */
  get core(): SlaEngine {
    return this.engine;
  }
}
