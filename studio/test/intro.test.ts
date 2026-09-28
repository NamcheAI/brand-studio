import assert from 'node:assert/strict';
import test from 'node:test';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { DAY_THEME, NIGHT_THEME, canvasThemeId } from '../src/lib/model';

// The test runner transpiles JSX with the classic runtime; Vite uses the automatic runtime.
(globalThis as typeof globalThis & { React: typeof React }).React = React;
const { default: Intro } = await import('../src/components/intro/Intro');

const html = renderToStaticMarkup(createElement(Intro));

test('the intro carries the pivot quote in the original German', () => {
  assert.match(html, /Vom Schachbrett zum Netzwerk/);
  assert.match(
    html,
    /statt geometrischer Trennung entsteht ein reaktives,\s+vernetztes System – lebendig, auf äußere Reize reagierend, auch dreidimensional\s+denkbar\./,
  );
  // …and the English paraphrase next to it.
  assert.match(html, /instead of geometric separation, a reactive, connected/);
});

test('the intro leads into the Studio', () => {
  assert.match(html, /href="\/studio"/);
  assert.match(html, /Open the Studio/);
});

test('the intro walks through the five steps that build the mark', () => {
  for (const caption of ['Nodes', 'Weight', 'Connection', 'Fusion', 'The mark']) {
    assert.match(html, new RegExp(`— ${caption}`));
  }
});

test('the intro art is drawn by the engine, not shipped as a bitmap', () => {
  assert.doesNotMatch(html, /<img[^>]+\.(png|jpe?g|webp)/i);
  // Traced engine geometry, plus the live fusion filter.
  assert.match(html, /<path d="M/);
  assert.match(html, /feGaussianBlur/);
});

test('the hero and the pivot band stay on the night ground in either theme', () => {
  // Two `dark` scopes are painted deliberately, not by following the interface.
  const nightBands = html.match(/<section class="dark[^"]*"/g) ?? [];
  assert.equal(nightBands.length, 2);
  // The hero mark is drawn in Selene, the night ink.
  assert.match(html, new RegExp(`fill="${NIGHT_THEME.ink}"`, 'i'));
});

test('a canvas theme is recognised only on an exact color match', () => {
  assert.equal(canvasThemeId(NIGHT_THEME), 'night');
  assert.equal(canvasThemeId(DAY_THEME), 'day');
  assert.equal(canvasThemeId({ ...DAY_THEME, ink: '#123456' }), null);
  assert.notEqual(NIGHT_THEME.bg, DAY_THEME.bg);
});
