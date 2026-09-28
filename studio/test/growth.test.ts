import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGrowthSchedule, scalesAtElapsed } from '../src/lib/growth';
import { PRESETS } from '../src/lib/model';

test('growth is deterministic and finishes every node', () => {
  const preset = PRESETS.find(({ id }) => id === 'r');
  assert.ok(preset);
  const first = buildGrowthSchedule(preset.nodes, preset.edges);
  const second = buildGrowthSchedule(preset.nodes, preset.edges);

  assert.deepEqual([...first.depths], [...second.depths]);
  const scales = scalesAtElapsed(first, Number.POSITIVE_INFINITY);
  assert.equal(scales.size, preset.nodes.length);
  assert.ok([...scales.values()].every((value) => value === 1));
});
