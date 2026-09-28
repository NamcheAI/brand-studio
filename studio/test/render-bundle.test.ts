import assert from 'node:assert/strict';
import test from 'node:test';
import { IMAGERY_RELEASE } from '@namche/imagery';
import {
  RENDER_BUNDLE_SCHEMA_VERSION,
  buildRenderProvenance,
} from '../src/lib/renderBundle';
import { DEFAULT_AI_METAMORPH_PARAMS, DEFAULT_AI_RENDER_PARAMS } from '../lib/ai-render-contract';

const RESULT = {
  image: 'data:image/png;base64,aGVsbG8=',
  model: 'gpt-image-2',
  prompt: 'PROMPT TEXT',
  requestId: 'req_123',
};
const SLUG = 'ig-1031312152456670682-168658-0';
const AT = '2026-08-28T21:43:07.000Z';

test('metamorph provenance pins the versioned texture URL and the seeding params', () => {
  const params = {
    ...DEFAULT_AI_RENDER_PARAMS,
    size: '2880x2880' as const,
    quality: 'high' as const,
    metamorph: { ...DEFAULT_AI_METAMORPH_PARAMS, deformAmount: 25, nubDensity: 8 },
  };
  const p = buildRenderProvenance({
    result: RESULT,
    params,
    textureSlug: SLUG,
    referenceName: null,
    createdAt: AT,
  });

  assert.equal(p.schemaVersion, RENDER_BUNDLE_SCHEMA_VERSION);
  assert.equal(p.createdAt, AT);
  assert.equal(p.render.model, 'gpt-image-2');
  assert.equal(p.render.size, '2880x2880');
  assert.equal(p.render.requestId, 'req_123');
  assert.equal(p.render.prompt, 'PROMPT TEXT');
  assert.equal(p.material.mode, 'metamorph');
  if (p.material.mode !== 'metamorph') throw new Error('expected metamorph');
  assert.equal(p.material.textureSlug, SLUG);
  assert.equal(p.material.imageryRelease, IMAGERY_RELEASE);
  // A versioned URL, never the mutable `current` alias — the render must stay
  // traceable after the next imagery release (or a retraction).
  assert.match(p.material.textureUrl, /\/images\/curated\/v\d+\.\d+\.\d+\//);
  assert.doesNotMatch(p.material.textureUrl, /\/current\//);
  // The exact knobs that seeded it survive verbatim.
  assert.equal(p.params.metamorph?.deformAmount, 25);
  assert.equal(p.params.metamorph?.nubDensity, 8);
});

test('provenance records how the material was supplied in each mode', () => {
  const uploaded = buildRenderProvenance({
    result: RESULT,
    params: { ...DEFAULT_AI_RENDER_PARAMS, metamorph: null },
    textureSlug: SLUG,
    referenceName: 'moss.jpg',
    createdAt: AT,
  });
  assert.deepEqual(uploaded.material, { mode: 'upload', referenceName: 'moss.jpg' });

  const described = buildRenderProvenance({
    result: RESULT,
    params: { ...DEFAULT_AI_RENDER_PARAMS, metamorph: null },
    textureSlug: null,
    referenceName: null,
    createdAt: AT,
  });
  assert.deepEqual(described.material, { mode: 'description-only' });

  // A slug that is no longer a valid texture must not be recorded as one.
  const stale = buildRenderProvenance({
    result: RESULT,
    params: { ...DEFAULT_AI_RENDER_PARAMS, metamorph: DEFAULT_AI_METAMORPH_PARAMS },
    textureSlug: 'retracted-slug',
    referenceName: null,
    createdAt: AT,
  });
  assert.equal(stale.material.mode, 'description-only');
});
