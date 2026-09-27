import assert from 'node:assert/strict';
import test from 'node:test';
import { ENGINE, generate } from '@namche/metaball';
import { toGenerateParams } from '../src/lib/coreDocument';
import { PRESETS, applyPresetShape, clonePreset } from '../src/lib/model';

const { VIEWBOX } = ENGINE;

test('the untouched studio default maps to the Namche Loop preset', () => {
  const preset = PRESETS[0];
  assert.equal(preset.id, 'loop');
  const doc = clonePreset(preset);

  assert.deepEqual(toGenerateParams(doc), { preset: 'loop' });
  assert.equal(generate(toGenerateParams(doc)).d, generate({ preset: 'loop' }).d);
  assert.equal(doc.fullGrid, false);
});

test('the approved legacy mark still maps to its exact vector preset', () => {
  const preset = PRESETS.find(({ id }) => id === 'brandmark');
  assert.ok(preset);
  const doc = clonePreset(preset);

  assert.deepEqual(toGenerateParams(doc), { preset: 'brandmark' });
  assert.equal(generate(toGenerateParams(doc)).d, generate({ preset: 'brandmark' }).d);
});

test('studio presets flatten through the canonical engine', () => {
  const preset = PRESETS.find(({ id }) => id === 'r');
  assert.ok(preset);
  const doc = clonePreset(preset);

  const fromStudio = generate({ ...toGenerateParams(doc), backend: 'pure' });
  const fromCore = generate({ preset: 'r', backend: 'pure' });

  assert.equal(fromStudio.d, fromCore.d);
});

test('high-resolution studio export stays in viewBox coordinates', () => {
  const preset = PRESETS.find(({ id }) => id === 'loop');
  assert.ok(preset);
  const doc = { ...clonePreset(preset), flattenResolution: 3 };
  const result = generate({ ...toGenerateParams(doc), backend: 'pure' });
  const coordinates = [...result.d.matchAll(/-?\d+(?:\.\d+)?/g)].map(([value]) => Number(value));

  assert.ok(coordinates.length > 0);
  assert.ok(Math.max(...coordinates) <= VIEWBOX + 1);
  assert.ok(Math.min(...coordinates) >= -1);
});

test('switching shape presets preserves appearance and 3D preferences', () => {
  const loop = PRESETS.find(({ id }) => id === 'loop');
  const classic = PRESETS.find(({ id }) => id === 'brandmark');
  assert.ok(loop && classic);
  const current = {
    ...clonePreset(classic),
    rasterEnabled: false,
    theme: { pink: '#111111', blue: '#222222', ink: '#333333', bg: '#444444' },
    materialPreset: 'rock',
    lookMode: 'liquid' as const,
  };

  const next = applyPresetShape(current, loop);
  assert.equal(next.rasterEnabled, false);
  assert.deepEqual(next.theme, current.theme);
  assert.equal(next.materialPreset, 'rock');
  assert.equal(next.lookMode, 'liquid');
  assert.deepEqual(toGenerateParams(next), { preset: 'loop' });
});
