import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SlaEngine} from '../src/engine';
import {SlaTriggerProcessor} from '../src/trigger/processor';
import {incidentTriggerPreset} from '../src/trigger/presets';
import type {ScheduleAction, StoredSlaRecord, SlaProcessResult} from '../src/trigger/types';
type Upsert = Extract<ScheduleAction, {type: 'upsert'}>;
import {
  EventBridgeSlaScheduler,
  InMemorySlaScheduler,
  parseIncidentEvent,
  parseSlaTimerMessage,
  toAtExpression,
  toEventBridgeEntries,
} from '../src/aws/eventbridge';

const H = 3600_000;
const T0 = Date.UTC(2026, 0, 5, 9, 0, 0);

function setup() {
  const engine = new SlaEngine()
    .addCalendar('24x7', {continuous: true})
    .addPolicy({
      id: 'resolution',
      metric: 'resolution',
      calendarId: '24x7',
      defaultTargetSeconds: 8 * 3600,
      rules: [{when: {priority: 'P1'}, targetSeconds: 4 * 3600, priority: 10}],
    });
  const processor = new SlaTriggerProcessor(engine, [
    incidentTriggerPreset({policyId: 'resolution', pauseStatuses: ['pending_customer']}),
  ]);
  return {engine, processor};
}

const upserts = (r: SlaProcessResult) => r.scheduleActions.filter((a): a is Upsert => a.type === 'upsert');
const deletes = (r: SlaProcessResult) => r.scheduleActions.filter(a => a.type === 'delete');
const types = (r: SlaProcessResult) => r.events.map(e => e.type);

test('create starts the SLA, stores details and schedules warning + breach', () => {
  const {processor} = setup();
  const r = processor.onIncidentChange({current: {id: 'INC-1', status: 'open', priority: 'P1'}, now: T0});
  assert.equal(r.records.length, 1);
  const rec = r.records[0];
  assert.equal(rec.targetSeconds, 4 * 3600);
  assert.equal(rec.status, 'running');
  assert.equal(rec.dueAt, T0 + 4 * H);
  assert.deepEqual(rec.dimensions, {priority: 'P1'});
  assert.deepEqual(types(r), ['started']);
  const u = upserts(r);
  assert.equal(u.length, 2);
  assert.equal(u.find(a => a.type === 'upsert' && a.payload.kind === 'warning')!.fireAt, T0 + 3 * H);
  assert.equal(u.find(a => a.type === 'upsert' && a.payload.kind === 'breach')!.fireAt, T0 + 4 * H);
  assert.equal(r.summary.nextDueAt, T0 + 4 * H);
  assert.equal(r.summary.openCount, 1);
});

test('unrelated update changes nothing in the scheduler', () => {
  const {processor} = setup();
  const a = processor.onIncidentChange({current: {id: 'INC-1', status: 'open', priority: 'P1'}, now: T0});
  const b = processor.onIncidentChange({
    previous: {id: 'INC-1', status: 'open', priority: 'P1'},
    current: {id: 'INC-1', status: 'open', priority: 'P1', title: 'x'},
    records: a.records,
    now: T0 + H,
  });
  assert.equal(b.scheduleActions.length, 0);
  assert.equal(b.events.length, 0);
  assert.equal(b.records[0].elapsedSeconds, 3600); // still refreshed
});

test('pause deletes schedules; resume reschedules with the deadline pushed out', () => {
  const {processor} = setup();
  const a = processor.onIncidentChange({current: {id: 'I', status: 'open', priority: 'P1'}, now: T0});
  const paused = processor.onIncidentChange({
    previous: {id: 'I', status: 'open', priority: 'P1'},
    current: {id: 'I', status: 'pending_customer', priority: 'P1'},
    records: a.records,
    now: T0 + H,
  });
  assert.deepEqual(types(paused), ['paused']);
  assert.equal(deletes(paused).length, 2);
  assert.equal(paused.records[0].status, 'paused');

  const resumed = processor.onIncidentChange({
    previous: {id: 'I', status: 'pending_customer', priority: 'P1'},
    current: {id: 'I', status: 'open', priority: 'P1'},
    records: paused.records,
    now: T0 + 3 * H,
  });
  assert.deepEqual(types(resumed), ['resumed']);
  const breach = upserts(resumed).find(a => a.type === 'upsert' && a.payload.kind === 'breach');
  assert.equal(breach!.fireAt, T0 + 6 * H); // 4h target + 2h hold
  assert.equal(resumed.records[0].version, 3);
});

test('resolve within target is met and removes schedules', () => {
  const {processor} = setup();
  const a = processor.onIncidentChange({current: {id: 'I', status: 'open', priority: 'P1'}, now: T0});
  const r = processor.onIncidentChange({
    previous: {id: 'I', status: 'open', priority: 'P1'},
    current: {id: 'I', status: 'resolved', priority: 'P1'},
    records: a.records,
    now: T0 + 2 * H,
  });
  assert.deepEqual(types(r), ['stopped', 'met']);
  assert.equal(r.records[0].status, 'met');
  assert.equal(deletes(r).length, 2);
  assert.equal(upserts(r).length, 0);
  assert.equal(r.summary.openCount, 0);
});

test('priority change retargets and reschedules', () => {
  const {processor} = setup();
  const a = processor.onIncidentChange({current: {id: 'I', status: 'open', priority: 'P3'}, now: T0});
  assert.equal(a.records[0].targetSeconds, 8 * 3600);
  const r = processor.onIncidentChange({
    previous: {id: 'I', status: 'open', priority: 'P3'},
    current: {id: 'I', status: 'open', priority: 'P1'},
    records: a.records,
    now: T0 + H,
  });
  assert.deepEqual(types(r), ['retargeted']);
  assert.equal(r.records[0].targetSeconds, 4 * 3600);
  assert.equal(r.records[0].dueAt, T0 + 4 * H);
  assert.equal(upserts(r).length, 2);
});

test('timer: current version fires breach; stale version is ignored', () => {
  const {processor} = setup();
  const a = processor.onIncidentChange({current: {id: 'I', status: 'open', priority: 'P1'}, now: T0});
  const breach = upserts(a).find(x => x.type === 'upsert' && x.payload.kind === 'breach')!;
  assert.equal(breach.type, 'upsert');
  const payload = breach.type === 'upsert' ? breach.payload : (null as never);

  const fired = processor.onTimer({payload, records: a.records, now: T0 + 4 * H}); // exactly on time
  assert.equal(fired.stale, undefined);
  assert.ok(types(fired).includes('breached'));
  assert.equal(fired.records[0].status, 'breached');
  assert.equal(fired.summary.breached, true);

  const stale = processor.onTimer({payload: {...payload, version: 0}, records: a.records, now: T0 + 4 * H});
  assert.equal(stale.stale, true);
  assert.equal(stale.events.length, 0);
});

test('catch-up: an update after the due time fires missed timers inline', () => {
  const {processor} = setup();
  const a = processor.onIncidentChange({current: {id: 'I', status: 'open', priority: 'P1'}, now: T0});
  const r = processor.onIncidentChange({
    previous: {id: 'I', status: 'open', priority: 'P1'},
    current: {id: 'I', status: 'open', priority: 'P1', note: 'x'},
    records: a.records,
    now: T0 + 5 * H,
  });
  assert.deepEqual(types(r), ['timer', 'timer', 'breached']);
  assert.equal(r.records[0].timers.every(t => t.firedAt !== undefined), true);
  assert.equal(r.scheduleActions.every(x => x.type === 'delete'), true);
});

test('reopen resumes the clock excluding the closed period', () => {
  const {processor} = setup();
  let r = processor.onIncidentChange({current: {id: 'I', status: 'open', priority: 'P1'}, now: T0});
  r = processor.onIncidentChange({
    previous: {id: 'I', status: 'open', priority: 'P1'},
    current: {id: 'I', status: 'resolved', priority: 'P1'},
    records: r.records,
    now: T0 + H,
  });
  r = processor.onIncidentChange({
    previous: {id: 'I', status: 'resolved', priority: 'P1'},
    current: {id: 'I', status: 'open', priority: 'P1'},
    records: r.records,
    now: T0 + 10 * H,
  });
  assert.deepEqual(types(r), ['reopened']);
  assert.equal(r.records[0].elapsedSeconds, 3600);
  assert.equal(r.records[0].dueAt, T0 + 13 * H);
});

test('end-to-end with the in-memory scheduler', async () => {
  const {processor} = setup();
  const sched = new InMemorySlaScheduler();
  let records: StoredSlaRecord[] = [];
  const r = processor.onIncidentChange({current: {id: 'I', status: 'open', priority: 'P1'}, now: T0});
  records = r.records;
  await sched.apply(r.scheduleActions);
  assert.equal(sched.schedules.size, 2);
  const due = sched.due(T0 + 3 * H);
  assert.equal(due.length, 1);
  const w = processor.onTimer({payload: due[0], records, now: T0 + 3 * H});
  assert.deepEqual(types(w), ['timer']);
  assert.equal(w.events[0].kind, 'warning');
});

test('EventBridgeSlaScheduler: create, conflict→update, delete ignores not-found', async () => {
  const sent: Array<{cmd: string; input: Record<string, unknown>}> = [];
  class Cmd {
    constructor(public readonly name: string, public readonly input: Record<string, unknown>) {}
  }
  const commands = {
    CreateScheduleCommand: class extends Cmd { constructor(i: never) { super('create', i); } },
    UpdateScheduleCommand: class extends Cmd { constructor(i: never) { super('update', i); } },
    DeleteScheduleCommand: class extends Cmd { constructor(i: never) { super('delete', i); } },
  };
  const existing = new Set(['dup']);
  const client = {
    async send(c: unknown) {
      const cmd = c as Cmd;
      sent.push({cmd: cmd.name, input: cmd.input});
      if (cmd.name === 'create' && existing.has(cmd.input['Name'] as string)) {
        throw Object.assign(new Error('exists'), {name: 'ConflictException'});
      }
      if (cmd.name === 'delete') throw Object.assign(new Error('nf'), {name: 'ResourceNotFoundException'});
      return {};
    },
  };
  const s = new EventBridgeSlaScheduler({
    client,
    commands,
    targetArn: 'arn:aws:sqs:us-east-1:1:sla-timers',
    roleArn: 'arn:aws:iam::1:role/scheduler',
    groupName: 'crm-sla',
    concurrency: 1,
  });
  const payload = {type: 'sla.timer' as const, incidentId: 'I', policyId: 'p', metric: 'm', kind: 'breach', version: 1, fireAt: T0};
  const res = await s.apply([
    {type: 'upsert', name: 'new', fireAt: T0 + 1500, payload},
    {type: 'upsert', name: 'dup', fireAt: T0, payload},
    {type: 'delete', name: 'gone'},
  ]);
  assert.ok(res.every(x => x.ok));
  assert.deepEqual(sent.map(x => x.cmd), ['create', 'create', 'update', 'delete']);
  assert.equal(sent[0].input['ScheduleExpression'], `at(${toAtExpression(T0 + 2000)})`);
  assert.equal(sent[0].input['ActionAfterCompletion'], 'DELETE');
  assert.equal(sent[0].input['GroupName'], 'crm-sla');
});

test('parsers handle SQS bodies and EventBridge envelopes', () => {
  const payload = {type: 'sla.timer', incidentId: 'I', policyId: 'p', metric: 'm', kind: 'breach', version: 2, fireAt: 1};
  assert.deepEqual(parseSlaTimerMessage(JSON.stringify(payload)), payload);
  assert.deepEqual(parseSlaTimerMessage({Body: JSON.stringify(payload)}), payload);
  assert.equal(parseSlaTimerMessage({foo: 1}), null);

  const ev = {
    id: 'e1',
    'detail-type': 'Incident Updated',
    source: 'crm.incidents',
    time: '2026-01-05T09:00:00Z',
    detail: {incident: {id: 'I', status: 'open'}, previous: {id: 'I', status: 'new'}},
  };
  const parsed = parseIncidentEvent({body: JSON.stringify(ev)})!;
  assert.equal(parsed.change, 'update');
  assert.equal(parsed.current['status'], 'open');
  assert.equal(parsed.previous!['status'], 'new');
  assert.equal(parsed.eventId, 'e1');
  assert.equal(parseIncidentEvent({...ev, 'detail-type': 'Other'}), null);

  const batches = toEventBridgeEntries(
    Array.from({length: 12}, () => ({
      type: 'breached' as const, incidentId: 'I', policyId: 'p', metric: 'm', at: T0, version: 1,
      status: 'breached' as const, dueAt: T0, targetSeconds: 1,
    })),
  );
  assert.equal(batches.length, 2);
  assert.equal(batches[0][0]['DetailType'], 'SLA breached');
});

test('schedule names are AWS-safe and at most 64 chars', () => {
  const {processor} = setup();
  const n = processor.scheduleName('INC/with spaces'.repeat(10), 'resolution', 'warning');
  assert.ok(n.length <= 64);
  assert.match(n, /^[0-9A-Za-z_.-]+$/);
});
