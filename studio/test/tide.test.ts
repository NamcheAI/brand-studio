import assert from 'node:assert/strict';
import test from 'node:test';
import { TIDE_PERIOD_MS, tidePhasesAtElapsed } from '../src/lib/tide';

test('tide stays continuous across the animation seam', () => {
  const beforeWrap = tidePhasesAtElapsed(TIDE_PERIOD_MS - 1);
  const afterWrap = tidePhasesAtElapsed(0);

  assert.ok(beforeWrap.fill > 0.999);
  assert.equal(afterWrap.fill, 1);
  assert.ok(Math.abs(beforeWrap.merge - afterWrap.merge) < 0.001);
  assert.ok(Math.abs(beforeWrap.evaporate - afterWrap.evaporate) < 0.001);
});

test('tide includes an empty beat between evaporation and reform', () => {
  const empty = tidePhasesAtElapsed(TIDE_PERIOD_MS * 0.61);
  const reforming = tidePhasesAtElapsed(TIDE_PERIOD_MS * 0.8);

  assert.equal(empty.fill, 0);
  assert.ok(reforming.fill > 0 && reforming.fill < 1);
});
