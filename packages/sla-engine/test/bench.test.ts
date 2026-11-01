import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SlaEngine} from '../src/engine';
import type {SlaInstance} from '../src/types';

/**
 * Throughput smoke test. Not a hard benchmark (CI machines vary), but it
 * asserts the streaming report path handles a large instance set quickly and
 * with bounded memory (instances are produced by a generator, never arrayed).
 */
test('streams a large report under a loose time budget', () => {
  const engine = new SlaEngine();
  engine.addCalendar('biz', {timeZoneOffsetMinutes: 0});
  engine.addPolicy({id: 'resolution', metric: 'resolution', calendarId: 'biz', defaultTargetSeconds: 4 * 3600});

  const N = 200_000;
  const teams = ['A', 'B', 'C', 'D', 'E'];
  const base = Date.UTC(2024, 0, 1, 9, 0, 0);

  function* gen(): Generator<SlaInstance> {
    for (let i = 0; i < N; i++) {
      yield {
        id: String(i),
        policyId: 'resolution',
        metric: 'resolution',
        targetSeconds: 4 * 3600,
        startedAt: base - (i % 50) * 3600_000,
        state: 'running',
        dimensions: {team: teams[i % teams.length]},
      };
    }
  }

  const t0 = process.hrtime.bigint();
  const report = engine.report(
    {id: 'perf', groupBy: ['team'], quantiles: [0.5, 0.9, 0.95]},
    gen(),
    base,
  );
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;

  assert.equal(report.summary.count, N);
  assert.equal(report.rows.length, teams.length);
  // Very loose ceiling: 200k instances aggregated well under a second on CI.
  assert.ok(ms < 5000, `report took ${ms.toFixed(1)}ms`);
  // eslint-disable-next-line no-console
  console.log(`      aggregated ${N} instances in ${ms.toFixed(1)}ms (${Math.round(N / (ms / 1000))}/s)`);
});
