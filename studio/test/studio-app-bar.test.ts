import assert from 'node:assert/strict';
import test from 'node:test';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { BRAND, WORKSPACES } from '../src/lib/brand';

// The test runner transpiles JSX with the classic runtime; Vite uses the automatic runtime.
(globalThis as typeof globalThis & { React: typeof React }).React = React;
const { StudioAppBar } = await import('../src/components/shell/StudioAppBar');

test('StudioAppBar names the product, links every workspace, and marks the active one', () => {
  const html = renderToStaticMarkup(createElement(StudioAppBar, { active: 'object' }));

  assert.match(html, new RegExp(BRAND.wordmark));
  assert.match(html, new RegExp(BRAND.product));

  for (const workspace of WORKSPACES) {
    assert.match(html, new RegExp(`href="${workspace.href}"`));
  }

  // Only the active workspace's link carries aria-current="page".
  const current = html.match(/<a[^>]*aria-current="page"[^>]*>([^<]*)<\/a>/);
  assert.ok(current, 'exactly one link is marked as the current page');
  assert.match(current![0], /href="\/studio\/object"/);
  assert.equal(current![1], 'Object');
});

test('StudioAppBar renders no active link when nothing is current', () => {
  const html = renderToStaticMarkup(createElement(StudioAppBar, { active: null }));
  assert.doesNotMatch(html, /aria-current="page"/);
});
