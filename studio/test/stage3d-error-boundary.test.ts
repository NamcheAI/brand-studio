import assert from 'node:assert/strict';
import test from 'node:test';
import React, { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// The test runner transpiles JSX with the classic runtime; Vite uses the automatic runtime.
(globalThis as typeof globalThis & { React: typeof React }).React = React;
const { Stage3DErrorBoundary, Stage3DErrorFallback } = await import(
  '../src/components/stage/Stage3DErrorBoundary'
);
const { classifyStageError, stageErrorCopy } = await import('../src/lib/stageErrors');

const hdrError = new Error(
  'Could not load /assets/studio_small_03_1k-abc123.hdr: fetch for "/assets/studio_small_03_1k-abc123.hdr" responded with 503',
);
const cdnError = new Error('Could not load studio_small_03_1k.hdr: Failed to fetch');

test('HDR loader failures are classified as environment errors', () => {
  assert.equal(classifyStageError(hdrError), 'environment');
  assert.equal(classifyStageError(cdnError), 'environment');
});

test('lazy chunk failures are classified per browser wording', () => {
  for (const message of [
    'Failed to fetch dynamically imported module: http://localhost:5173/src/components/Metaball3DPreview.tsx',
    'error loading dynamically imported module',
    'Importing a module script failed.',
  ]) {
    assert.equal(classifyStageError(new TypeError(message)), 'module', message);
  }
});

test('other failures stay generic', () => {
  assert.equal(classifyStageError(new Error('Error creating WebGL context.')), 'unknown');
  assert.equal(classifyStageError('boom'), 'unknown');
});

test('the liquid copy names the liquid environment', () => {
  assert.equal(stageErrorCopy('environment', 'liquid').title, "Couldn't load the liquid environment");
  assert.match(stageErrorCopy('environment', 'liquid').hint, /check your connection/i);
  assert.equal(stageErrorCopy('environment', 'material').title, "Couldn't load the studio environment");
});

test('the fallback offers Retry and, only for Liquid, the Organic look', () => {
  const liquid = renderToStaticMarkup(
    createElement(Stage3DErrorFallback, {
      error: hdrError,
      lookMode: 'liquid',
      onRetry: () => {},
      onUseOrganic: () => {},
    }),
  );
  assert.match(liquid, /role="alert"/);
  assert.match(liquid, /Couldn(&#x27;|')t load the liquid environment/);
  assert.match(liquid, />Retry</);
  assert.match(liquid, />Use Organic look</);

  const organic = renderToStaticMarkup(
    createElement(Stage3DErrorFallback, {
      error: hdrError,
      lookMode: 'material',
      onRetry: () => {},
      onUseOrganic: () => {},
    }),
  );
  assert.match(organic, />Retry</);
  assert.doesNotMatch(organic, /Use Organic look/);
});

// Server rendering does not run error boundaries, so drive the lifecycle directly.
function boundaryWith(props: ConstructorParameters<typeof Stage3DErrorBoundary>[0]) {
  const boundary = new Stage3DErrorBoundary(props);
  const updates: unknown[] = [];
  boundary.setState = ((next: Partial<typeof boundary.state>) => {
    updates.push(next);
    boundary.state = { ...boundary.state, ...next };
  }) as typeof boundary.setState;
  return { boundary, updates };
}

test('the boundary renders children until a stage error, then the fallback', () => {
  const child = createElement('canvas', { id: 'stage' });
  const { boundary } = boundaryWith({ lookMode: 'liquid', children: child });
  assert.equal(boundary.render(), child);

  boundary.state = { ...boundary.state, ...Stage3DErrorBoundary.getDerivedStateFromError(hdrError) };
  const html = renderToStaticMarkup(boundary.render() as ReactElement);
  assert.match(html, /liquid environment/);
  assert.doesNotMatch(html, /<canvas/);
});

test('Retry reports the error, then remounts the stage', () => {
  const seen: unknown[] = [];
  const { boundary, updates } = boundaryWith({
    lookMode: 'liquid',
    onRetry: (error) => seen.push(error),
    children: null,
  });
  boundary.state = { error: hdrError, lookMode: 'liquid' };
  boundary.retry();
  assert.deepEqual(seen, [hdrError]);
  assert.deepEqual(updates, [{ error: null }]);
});

test('switching the look clears the error so the Organic fallback remounts', () => {
  const failed = { error: hdrError, lookMode: 'liquid' as const };
  assert.deepEqual(
    Stage3DErrorBoundary.getDerivedStateFromProps({ lookMode: 'material', children: null }, failed),
    { error: null, lookMode: 'material' },
  );
  assert.equal(
    Stage3DErrorBoundary.getDerivedStateFromProps({ lookMode: 'liquid', children: null }, failed),
    null,
    'an unrelated re-render keeps the fallback',
  );
});
