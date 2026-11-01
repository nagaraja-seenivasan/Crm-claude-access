import {BusinessCalendar} from './calendar';
import {SlaPolicy} from './policy';
import {buildReport, type ReportDefinition, type ReportResult} from './report/report';
import {evaluateInstance} from './tracker';
import {toEpochMs} from './time';
import type {
  BusinessCalendarConfig,
  EpochMs,
  SlaEvaluation,
  SlaInstance,
  SlaPolicyConfig,
  TimeInput,
} from './types';

/**
 * The façade that applications use. Register business calendars and SLA
 * policies once, then evaluate instances and build reports.
 *
 * ## Efficiency
 *
 * - Calendars and policies are resolved from `Map`s (O(1)).
 * - {@link evaluateMany} yields evaluations lazily (a generator), so a report
 *   can be built over a huge instance set without ever holding the full array
 *   of evaluations in memory — only the (small) grouped accumulators persist.
 */
export class SlaEngine {
  private readonly calendars = new Map<string, BusinessCalendar>();
  private readonly policies = new Map<string, SlaPolicy>();

  constructor() {
    // Always provide a sensible default (Mon–Fri 9–5) calendar.
    this.calendars.set('default', new BusinessCalendar({id: 'default'}));
  }

  /** Register (or replace) a business calendar. */
  addCalendar(id: string, config: BusinessCalendarConfig): this {
    this.calendars.set(id, new BusinessCalendar({...config, id}));
    return this;
  }

  getCalendar(id = 'default'): BusinessCalendar {
    const cal = this.calendars.get(id);
    if (!cal) throw new Error(`Unknown calendar: ${id}`);
    return cal;
  }

  /** Register (or replace) an SLA policy. */
  addPolicy(config: SlaPolicyConfig): this {
    this.policies.set(config.id, new SlaPolicy(config));
    return this;
  }

  getPolicy(id: string): SlaPolicy {
    const p = this.policies.get(id);
    if (!p) throw new Error(`Unknown policy: ${id}`);
    return p;
  }

  /**
   * Build an {@link SlaInstance} from a tracked entity by resolving its target
   * from the referenced policy's rules.
   */
  startInstance(params: {
    id: string;
    policyId: string;
    startedAt: TimeInput;
    dimensions?: SlaInstance['dimensions'];
  }): SlaInstance {
    const policy = this.getPolicy(params.policyId);
    const targetSeconds = policy.resolveTargetSeconds(params.dimensions);
    return {
      id: params.id,
      policyId: policy.id,
      metric: policy.metric,
      targetSeconds,
      startedAt: toEpochMs(params.startedAt),
      state: 'running',
      dimensions: params.dimensions,
    };
  }

  /** Evaluate a single instance against its policy's calendar. */
  evaluate(instance: SlaInstance, now: TimeInput = Date.now()): SlaEvaluation {
    const policy = this.getPolicy(instance.policyId);
    const cal = this.getCalendar(policy.calendarId);
    return evaluateInstance(instance, cal, toEpochMs(now));
  }

  /**
   * Lazily evaluate many instances. Returns a generator so the caller (or
   * {@link report}) can stream results without buffering.
   */
  *evaluateMany(
    instances: Iterable<SlaInstance>,
    now: TimeInput = Date.now(),
  ): Generator<SlaEvaluation> {
    const nowMs: EpochMs = toEpochMs(now);
    for (const inst of instances) yield this.evaluate(inst, nowMs);
  }

  /**
   * Evaluate `instances` and build a report in one streaming pass. This is the
   * primary entry point for the report-optimised path.
   */
  report(
    def: ReportDefinition,
    instances: Iterable<SlaInstance>,
    now: TimeInput = Date.now(),
  ): ReportResult {
    return buildReport(def, this.evaluateMany(instances, now));
  }

  /** Build a report directly from pre-computed evaluations. */
  reportFromEvaluations(
    def: ReportDefinition,
    evaluations: Iterable<SlaEvaluation>,
  ): ReportResult {
    return buildReport(def, evaluations);
  }
}
