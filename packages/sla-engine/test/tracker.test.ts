import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BusinessCalendar} from '../src/calendar';
import {evaluateInstance} from '../src/tracker';
import type {SlaInstance} from '../src/types';

const H = 3600;
const MON_09 = Date.UTC(2024, 0, 1, 9, 0, 0);

const cal = new BusinessCalendar({continuous: true});

function inst(over: Partial<SlaInstance> = {}): SlaInstance {
  return {
    id: 't1',
    policyId: 'p',
    metric: 'resolution',
    targetSeconds: 4 * H,
    startedAt: MON_09,
    state: 'running',
    ...over,
  };
}

test('running within target', () => {
  const ev = evaluateInstance(inst(), cal, MON_09 + 2 * H * 1000);
  assert.equal(ev.status, 'running');
  assert.equal(ev.elapsedSeconds, 2 * H);
  assert.equal(ev.remainingSeconds, 2 * H);
  assert.equal(ev.consumedRatio, 0.5);
  assert.equal(ev.met, false);
});

test('breach when elapsed exceeds target', () => {
  const ev = evaluateInstance(inst(), cal, MON_09 + 5 * H * 1000);
  assert.equal(ev.status, 'breached');
  assert.ok(ev.remainingSeconds < 0);
  assert.equal(ev.breachedAt, MON_09 + 4 * H * 1000);
});

test('completed within target is met', () => {
  const ev = evaluateInstance(
    inst({state: 'completed', completedAt: MON_09 + 3 * H * 1000}),
    cal,
    MON_09 + 10 * H * 1000,
  );
  assert.equal(ev.status, 'met');
  assert.equal(ev.met, true);
  assert.equal(ev.elapsedSeconds, 3 * H);
});

test('completed late is breached', () => {
  const ev = evaluateInstance(
    inst({state: 'completed', completedAt: MON_09 + 6 * H * 1000}),
    cal,
    MON_09 + 10 * H * 1000,
  );
  assert.equal(ev.status, 'breached');
  assert.equal(ev.met, false);
});

test('holds pause the clock and push the deadline', () => {
  // Hold for 2h in the middle; at now=6h, elapsed should be 4h (not 6h).
  const ev = evaluateInstance(
    inst({holds: [{from: MON_09 + 1 * H * 1000, to: MON_09 + 3 * H * 1000}]}),
    cal,
    MON_09 + 6 * H * 1000,
  );
  assert.equal(ev.elapsedSeconds, 4 * H);
  assert.equal(ev.remainingSeconds, 0);
  assert.equal(ev.status, 'running'); // 4h elapsed == 4h target, not yet over
});

test('open hold reports paused', () => {
  const ev = evaluateInstance(
    inst({holds: [{from: MON_09 + 1 * H * 1000}]}),
    cal,
    MON_09 + 2 * H * 1000,
  );
  assert.equal(ev.status, 'paused');
  assert.equal(ev.elapsedSeconds, 1 * H);
});

test('cancelled instance', () => {
  const ev = evaluateInstance(inst({state: 'cancelled'}), cal, MON_09 + 2 * H * 1000);
  assert.equal(ev.status, 'cancelled');
});
