import {test} from 'node:test';
import assert from 'node:assert/strict';
import {P2Quantile} from '../src/report/p-square';
import {buildReport} from '../src/report/report';
import {SlaEngine} from '../src/engine';
import type {SlaEvaluation} from '../src/types';

test('P2 estimates the median of a uniform stream', () => {
  const est = new P2Quantile(0.5);
  for (let i = 1; i <= 10_000; i++) est.push(i);
  const v = est.value()!;
  assert.ok(Math.abs(v - 5000) / 5000 < 0.02, `median ~5000, got ${v}`);
});

test('P2 estimates p95 within tolerance', () => {
  const est = new P2Quantile(0.95);
  for (let i = 1; i <= 10_000; i++) est.push(i);
  const v = est.value()!;
  assert.ok(Math.abs(v - 9500) / 9500 < 0.03, `p95 ~9500, got ${v}`);
});

function ev(over: Partial<SlaEvaluation>): SlaEvaluation {
  return {
    id: 'x',
    policyId: 'p',
    metric: 'resolution',
    status: 'met',
    elapsedSeconds: 100,
    remainingSeconds: 0,
    consumedRatio: 0.5,
    dueAt: 0,
    met: true,
    evaluatedAt: 0,
    ...over,
  };
}

test('buildReport summarises and groups', () => {
  const data: SlaEvaluation[] = [
    ev({elapsedSeconds: 100, status: 'met', met: true, dimensions: {team: 'A'}}),
    ev({elapsedSeconds: 300, status: 'breached', met: false, dimensions: {team: 'A'}}),
    ev({elapsedSeconds: 200, status: 'met', met: true, dimensions: {team: 'B'}}),
  ];
  const r = buildReport({id: 'r', groupBy: ['team'], sortBy: 'count', sortDir: 'desc'}, data);
  assert.equal(r.included, 3);
  assert.equal(r.summary.count, 3);
  assert.equal(r.summary.breached, 1);
  assert.equal(r.summary.avg, 200);
  const teamA = r.rows.find(x => x.key.team === 'A')!;
  assert.equal(teamA.stats.count, 2);
  assert.equal(teamA.stats.breached, 1);
  assert.equal(teamA.stats.breachRate, 0.5);
});

test('filters restrict the population', () => {
  const data = [ev({status: 'breached', met: false}), ev({status: 'met'})];
  const r = buildReport({id: 'r', filters: [{field: 'status', op: 'eq', value: 'breached'}]}, data);
  assert.equal(r.included, 1);
  assert.equal(r.scanned, 2);
});

test('engine end-to-end streaming report', () => {
  const engine = new SlaEngine();
  engine.addCalendar('cont', {continuous: true});
  engine.addPolicy({
    id: 'resolution',
    metric: 'resolution',
    calendarId: 'cont',
    defaultTargetSeconds: 3600,
    rules: [{when: {priority: 'high'}, targetSeconds: 1800, priority: 10}],
  });

  const base = Date.UTC(2024, 0, 1, 9, 0, 0);
  const instances = [
    engine.startInstance({id: '1', policyId: 'resolution', startedAt: base, dimensions: {priority: 'high', team: 'A'}}),
    engine.startInstance({id: '2', policyId: 'resolution', startedAt: base, dimensions: {priority: 'low', team: 'A'}}),
  ];
  // High-priority target is 1800s; evaluate 2000s later -> breached.
  const now = base + 2000 * 1000;
  const report = engine.report({id: 'by-team', groupBy: ['team']}, instances, now);
  assert.equal(report.summary.count, 2);
  const teamA = report.rows[0];
  assert.equal(teamA.stats.count, 2);
  assert.equal(teamA.stats.breached, 1); // only the high-priority one breaches
});
