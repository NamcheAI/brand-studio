import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DOCUMENT_VERSION,
  GOO_STD_MAX,
  OFFSET_MAX,
  RADIUS_MAX,
  SURFACE_SAMPLER_COUNT_MAX,
  TUBE_FACTOR_MIN,
  edgeKey,
  presetIdForDocument,
} from '../src/lib/model';
import { STORAGE_KEY, initialDocument, loadDocument, normalizeDocument, parseDocumentJson } from '../src/lib/persistence';

const LEGACY_STORAGE_KEY = 'metaball-editor-document';

/**
 * A minimal in-memory localStorage stand-in — Node's test runner has no DOM.
 * Node's test runner shares one module instance across this file's tests, so
 * every stub is removed again once its test finishes; otherwise it would
 * leak into unrelated tests (e.g. `initialDocument()` would start reading
 * this fake storage instead of running with none, as those tests assume).
 */
function stubLocalStorage(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  const stub: Storage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, String(value)),
    removeItem: (key) => void store.delete(key),
    clear: () => store.clear(),
    key: (index) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
  const target = globalThis as typeof globalThis & { localStorage?: Storage };
  const previous = target.localStorage;
  target.localStorage = stub;
  return {
    store,
    restore: () => {
      target.localStorage = previous;
    },
  };
}

test('import sanitizes geometry, styles, and studio settings', () => {
  const doc = normalizeDocument({
    nodes: [
      { r: 1, c: 1, size: 'XL', radius: 999, offsetX: -999 },
      { r: 1, c: 1, size: 'S' },
      { r: 2, c: 2, size: 'invalid' },
      { r: 99, c: 99, size: 'L' },
    ],
    edges: [
      ['1-1', '2-2'],
      ['1-1', '2-2'],
      ['1-1', '4-4'],
    ],
    edgeFactors: { [edgeKey('1-1', '2-2')]: -10, '1-1|4-4': 0.9 },
    gooStd: 999,
    surfaceSamplerCount: 999999,
    theme: { pink: 'not-a-color', blue: '#123456', ink: '#000', bg: '#fff' },
  });

  assert.equal(doc.nodes.length, 2);
  assert.equal(doc.nodes[0].radius, undefined);
  assert.equal(doc.nodes[1].radius, undefined);
  assert.equal(doc.nodes[1].size, 'M');
  assert.equal(doc.edges.length, 1);
  assert.equal(doc.edgeFactors[edgeKey('1-1', '2-2')], TUBE_FACTOR_MIN);
  assert.equal(doc.edgeFactors['1-1|4-4'], undefined);
  assert.equal(doc.gooStd, GOO_STD_MAX);
  assert.equal(doc.surfaceSamplerCount, SURFACE_SAMPLER_COUNT_MAX);
  assert.equal(doc.theme.blue, '#123456');
});

test('individual node overrides are clamped', () => {
  const doc = normalizeDocument({
    nodes: [{ r: 1, c: 1, size: 'L', radius: 999, offsetX: -999 }],
  });
  assert.equal(doc.nodes[0].radius, RADIUS_MAX);
  assert.equal(doc.nodes[0].offsetX, -OFFSET_MAX);
});

test('invalid JSON still fails loudly for the UI error path', () => {
  assert.throws(() => parseDocumentJson('{'));
});

test('loadDocument migrates the pre-rename storage key to the new one', () => {
  const doc = initialDocument();
  const { store, restore } = stubLocalStorage({
    [LEGACY_STORAGE_KEY]: JSON.stringify({ ...doc, version: DOCUMENT_VERSION }),
  });
  try {
    const loaded = loadDocument();

    assert.ok(loaded);
    assert.equal(presetIdForDocument(loaded!), presetIdForDocument(doc));
    assert.ok(store.has(STORAGE_KEY), 'the document is copied onto the new key');
    assert.ok(!store.has(LEGACY_STORAGE_KEY), 'the old key is retired once migrated');
  } finally {
    restore();
  }
});

test('loadDocument prefers the new storage key when both are present', () => {
  const doc = initialDocument();
  const { restore } = stubLocalStorage({
    [STORAGE_KEY]: JSON.stringify({ ...doc, version: DOCUMENT_VERSION, rasterEnabled: false }),
    [LEGACY_STORAGE_KEY]: JSON.stringify({ ...doc, version: DOCUMENT_VERSION, rasterEnabled: true }),
  });
  try {
    const loaded = loadDocument();
    assert.equal(loaded?.rasterEnabled, false);
  } finally {
    restore();
  }
});

test('new documents use Namche Loop, raster on, and opt-in surface sampling', () => {
  const doc = initialDocument();
  assert.equal(presetIdForDocument(doc), 'loop');
  assert.equal(doc.rasterEnabled, true);
  assert.equal(doc.surfaceSamplerEnabled, false);
  assert.equal(doc.fullGrid, false);
});

test('raster visibility survives document normalization', () => {
  assert.equal(normalizeDocument({ rasterEnabled: false }).rasterEnabled, false);
  assert.equal(normalizeDocument({}).rasterEnabled, true);
});

test('version 10 migrates the full-bleed Classic graph into the shared inner frame', () => {
  const doc = normalizeDocument({
    version: 10,
    nodes: [
      { r: 0, c: 0, size: 'L', radius: 89.55, offsetX: 25.55, offsetY: 25.55 },
      { r: 0, c: 4, size: 'L', radius: 89.55, offsetX: -25.55, offsetY: 25.55 },
      { r: 2, c: 2, size: 'L', radius: 89.55 },
      { r: 4, c: 0, size: 'L', radius: 89.55, offsetX: 25.55, offsetY: -25.55 },
      { r: 4, c: 4, size: 'L', radius: 89.55, offsetX: -25.55, offsetY: -25.55 },
    ],
    edges: [
      ['0-0', '0-4'],
      ['0-4', '4-4'],
      ['4-0', '4-4'],
      ['2-2', '4-0'],
    ],
    fullGrid: true,
    tubeFactor: 0.22,
    rasterEnabled: false,
  });

  assert.equal(presetIdForDocument(doc), 'brandmark');
  assert.equal(doc.fullGrid, false);
  assert.equal(doc.rasterEnabled, false);
  assert.ok(doc.nodes.every(({ r, c }) => r >= 1 && r <= 3 && c >= 1 && c <= 3));
  assert.equal(DOCUMENT_VERSION, 12);
});

test('texture fields normalize: valid slug kept, junk dropped, ranges clamped', () => {
  const base = initialDocument();
  const good = normalizeDocument({
    ...base,
    textureSlug: 'ig-1031312152456670682-168658-0',
    textureScale: 99,
    textureAmount: -1,
    version: 12,
  });
  assert.equal(good.textureSlug, 'ig-1031312152456670682-168658-0');
  assert.equal(good.textureScale, 6);
  assert.equal(good.textureAmount, 0);

  const junk = normalizeDocument({ ...base, textureSlug: 'not-a-slug', version: 12 });
  assert.equal(junk.textureSlug, null);

  // a senses slug has no tile derivative and is not a valid surface texture
  const senses = normalizeDocument({ ...base, textureSlug: 'ig-368349807-168658-0', version: 12 });
  assert.equal(senses.textureSlug, null);

  // pre-texture documents (v11) get the defaults
  const legacy = normalizeDocument({ ...base, version: 11 } as never);
  assert.equal(legacy.textureSlug, null);
  assert.equal(legacy.textureScale, 1.6);
  assert.equal(legacy.textureAmount, 1);
});
