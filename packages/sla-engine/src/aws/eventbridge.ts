/**
 * AWS EventBridge integration for the SLA trigger processor.
 *
 * No AWS SDK is imported: the application passes its own
 * `@aws-sdk/client-scheduler` client and command classes. The library keeps
 * zero runtime dependencies and works with any SDK v3 version.
 */
import type {
  ChangeKind,
  IncidentRecord,
  ScheduleAction,
  ScheduleActionResult,
  SlaEvent,
  SlaScheduler,
  SlaTimerPayload,
} from '../trigger/types';
import {getPath} from '../trigger/conditions';

/** Minimal shape of an AWS SDK v3 client (`SchedulerClient`). */
export interface AwsClientLike {
  send(command: unknown): Promise<unknown>;
}

/** Command classes from `@aws-sdk/client-scheduler`. */
export interface SchedulerCommandClasses {
  CreateScheduleCommand: new (input: never) => unknown;
  UpdateScheduleCommand: new (input: never) => unknown;
  DeleteScheduleCommand: new (input: never) => unknown;
}

export interface EventBridgeSlaSchedulerOptions {
  client: AwsClientLike;
  commands: SchedulerCommandClasses;
  /** ARN of the target, e.g. an SQS queue or Lambda function. */
  targetArn: string;
  /** IAM role EventBridge Scheduler assumes to invoke the target. */
  roleArn: string;
  /** Schedule group (create it once, e.g. `crm-sla`). @default 'default' */
  groupName?: string;
  /** Extra target fields, e.g. `{SqsParameters: {MessageGroupId: 'sla'}}` for FIFO. */
  targetExtras?: Record<string, unknown>;
  /** Retry policy for the target. */
  retryPolicy?: {MaximumRetryAttempts?: number; MaximumEventAgeInSeconds?: number};
  /** Dead-letter queue ARN for undeliverable timers. */
  deadLetterArn?: string;
  /** Max concurrent API calls. @default 8 */
  concurrency?: number;
}

/**
 * Applies {@link ScheduleAction}s as **one-time EventBridge Scheduler
 * schedules** (`at(...)` expressions, UTC, no flexible window, deleted after
 * completion). Upserts create, falling back to update on conflict; deletes
 * ignore "not found" so repeated application is safe.
 */
export class EventBridgeSlaScheduler implements SlaScheduler {
  constructor(private readonly o: EventBridgeSlaSchedulerOptions) {}

  async apply(actions: ScheduleAction[]): Promise<ScheduleActionResult[]> {
    const results: ScheduleActionResult[] = new Array(actions.length);
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < actions.length) {
        const i = next++;
        try {
          await this.applyOne(actions[i]);
          results[i] = {action: actions[i], ok: true};
        } catch (error) {
          results[i] = {action: actions[i], ok: false, error};
        }
      }
    };
    const n = Math.max(1, Math.min(this.o.concurrency ?? 8, actions.length));
    await Promise.all(Array.from({length: n}, worker));
    return results;
  }

  /** The `CreateSchedule`/`UpdateSchedule` input for an upsert (exposed for testing/IaC). */
  scheduleInput(action: Extract<ScheduleAction, {type: 'upsert'}>): Record<string, unknown> {
    const o = this.o;
    return {
      Name: action.name,
      GroupName: o.groupName ?? 'default',
      ScheduleExpression: `at(${toAtExpression(action.fireAt)})`,
      ScheduleExpressionTimezone: 'UTC',
      FlexibleTimeWindow: {Mode: 'OFF'},
      ActionAfterCompletion: 'DELETE',
      State: 'ENABLED',
      Description: `SLA ${action.payload.kind} for ${action.payload.incidentId}`,
      Target: {
        Arn: o.targetArn,
        RoleArn: o.roleArn,
        Input: JSON.stringify(action.payload),
        ...(o.retryPolicy ? {RetryPolicy: o.retryPolicy} : {}),
        ...(o.deadLetterArn ? {DeadLetterConfig: {Arn: o.deadLetterArn}} : {}),
        ...(o.targetExtras ?? {}),
      },
    };
  }

  private async applyOne(action: ScheduleAction): Promise<void> {
    const {client, commands} = this.o;
    if (action.type === 'delete') {
      try {
        await client.send(
          new commands.DeleteScheduleCommand({Name: action.name, GroupName: this.o.groupName ?? 'default'} as never),
        );
      } catch (err) {
        if (errorName(err) !== 'ResourceNotFoundException') throw err;
      }
      return;
    }
    const input = this.scheduleInput(action);
    try {
      await client.send(new commands.CreateScheduleCommand(input as never));
    } catch (err) {
      if (errorName(err) !== 'ConflictException') throw err;
      await client.send(new commands.UpdateScheduleCommand(input as never));
    }
  }
}

/** `yyyy-mm-ddThh:mm:ss` (UTC) as required by `at()` expressions. */
export function toAtExpression(ms: number): string {
  return new Date(Math.ceil(ms / 1000) * 1000).toISOString().slice(0, 19);
}

function errorName(err: unknown): string | undefined {
  return (err as {name?: string})?.name;
}

// --- inbound parsing ------------------------------------------------------

function asObject(input: unknown): Record<string, unknown> | null {
  if (typeof input === 'string') {
    try {
      return asObject(JSON.parse(input));
    } catch {
      return null;
    }
  }
  return input && typeof input === 'object' ? (input as Record<string, unknown>) : null;
}

/**
 * Extract an {@link SlaTimerPayload} from whatever delivered it: the raw
 * payload, a JSON string, an SQS message/record (`Body`/`body`), or an
 * EventBridge envelope (`detail`). Returns `null` for anything else, so it can
 * be used to route mixed queues.
 */
export function parseSlaTimerMessage(input: unknown): SlaTimerPayload | null {
  const obj = asObject(input);
  if (!obj) return null;
  if (obj['type'] === 'sla.timer') {
    const p = obj as unknown as SlaTimerPayload;
    return typeof p.incidentId === 'string' && typeof p.policyId === 'string' && typeof p.version === 'number'
      ? p
      : null;
  }
  for (const key of ['Body', 'body', 'detail', 'Message']) {
    if (key in obj) return parseSlaTimerMessage(obj[key]);
  }
  return null;
}

export interface IncidentEventOptions {
  /** `detail-type` values meaning "created". @default ['Incident Created'] */
  createdTypes?: string[];
  /** `detail-type` values meaning "updated". @default ['Incident Updated'] */
  updatedTypes?: string[];
  /** Path in `detail` to the current incident. @default 'incident' */
  currentPath?: string;
  /** Path in `detail` to the previous incident (updates). @default 'previous' */
  previousPath?: string;
  /** Optional `source` allow-list. */
  sources?: string[];
}

export interface ParsedIncidentEvent {
  change: ChangeKind;
  current: IncidentRecord;
  previous?: IncidentRecord;
  /** EventBridge event id — useful for idempotency. */
  eventId?: string;
  /** EventBridge event time (epoch ms). */
  time?: number;
}

/**
 * Parse an incident create/update event coming from an **existing EventBridge
 * rule** (directly, or via an SQS/Lambda target). Returns `null` when the event
 * is not an incident event so the caller can route other messages elsewhere.
 */
export function parseIncidentEvent(input: unknown, opts: IncidentEventOptions = {}): ParsedIncidentEvent | null {
  let obj = asObject(input);
  if (obj && !('detail-type' in obj)) {
    for (const key of ['Body', 'body', 'Message']) {
      if (key in obj) {
        obj = asObject(obj[key]);
        break;
      }
    }
  }
  if (!obj || typeof obj['detail-type'] !== 'string') return null;
  if (opts.sources && !opts.sources.includes(String(obj['source']))) return null;

  const type = obj['detail-type'] as string;
  const created = opts.createdTypes ?? ['Incident Created'];
  const updated = opts.updatedTypes ?? ['Incident Updated'];
  const change: ChangeKind | null = created.includes(type) ? 'create' : updated.includes(type) ? 'update' : null;
  if (!change) return null;

  const detail = asObject(obj['detail']) ?? {};
  const current = asObject(getPath(detail, opts.currentPath ?? 'incident')) ?? detail;
  const previous = change === 'update' ? asObject(getPath(detail, opts.previousPath ?? 'previous')) ?? undefined : undefined;
  const t = typeof obj['time'] === 'string' ? Date.parse(obj['time'] as string) : NaN;
  return {
    change,
    current,
    previous,
    eventId: typeof obj['id'] === 'string' ? (obj['id'] as string) : undefined,
    time: Number.isFinite(t) ? t : undefined,
  };
}

// --- outbound events ------------------------------------------------------

export interface SlaEventEntryOptions {
  /** @default 'crm.sla' */
  source?: string;
  eventBusName?: string;
  /** Prefix for `DetailType`, e.g. `SLA breached`. @default 'SLA ' */
  detailTypePrefix?: string;
}

/**
 * Map {@link SlaEvent}s to `PutEvents` entries so other systems can subscribe
 * to SLA transitions on EventBridge. Returned in batches of ≤ 10 (the
 * `PutEvents` limit).
 */
export function toEventBridgeEntries(
  events: SlaEvent[],
  opts: SlaEventEntryOptions = {},
): Array<Array<Record<string, unknown>>> {
  const entries = events.map(e => ({
    Source: opts.source ?? 'crm.sla',
    DetailType: `${opts.detailTypePrefix ?? 'SLA '}${e.type === 'timer' ? e.kind : e.type}`,
    Detail: JSON.stringify(e),
    Time: new Date(e.at),
    ...(opts.eventBusName ? {EventBusName: opts.eventBusName} : {}),
  }));
  const batches: Array<Array<Record<string, unknown>>> = [];
  for (let i = 0; i < entries.length; i += 10) batches.push(entries.slice(i, i + 10));
  return batches;
}

// --- local / test scheduler ------------------------------------------------

/**
 * In-memory {@link SlaScheduler} for tests and local development. Call
 * {@link due} to collect payloads whose time has come.
 */
export class InMemorySlaScheduler implements SlaScheduler {
  readonly schedules = new Map<string, {fireAt: number; payload: SlaTimerPayload}>();

  async apply(actions: ScheduleAction[]): Promise<ScheduleActionResult[]> {
    for (const a of actions) {
      if (a.type === 'delete') this.schedules.delete(a.name);
      else this.schedules.set(a.name, {fireAt: a.fireAt, payload: a.payload});
    }
    return actions.map(action => ({action, ok: true}));
  }

  /** Remove and return payloads due at `now`, earliest first. */
  due(now: number): SlaTimerPayload[] {
    const out = [...this.schedules.entries()]
      .filter(([, s]) => s.fireAt <= now)
      .sort((a, b) => a[1].fireAt - b[1].fireAt);
    for (const [name] of out) this.schedules.delete(name);
    return out.map(([, s]) => s.payload);
  }
}
