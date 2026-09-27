import assert from 'node:assert/strict';
import test from 'node:test';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// The test runner transpiles JSX with the classic runtime; Vite uses the automatic runtime.
(globalThis as typeof globalThis & { React: typeof React }).React = React;
const { default: AppCredits } = await import('../src/components/AppCredits');

test('the editor credits link the repository and original design collaborators', () => {
  const html = renderToStaticMarkup(createElement(AppCredits));

  assert.match(html, /https:\/\/github\.com\/NamcheAI\/metaball/);
  assert.match(html, /https:\/\/github\.com\/fizzybubbele/);
  assert.match(html, /https:\/\/ruhmetc\.com\//);
  assert.match(html, /Michael Marte/);
  assert.match(html, /Ruhm etc\./);
  assert.match(html, /Original Studio by/);
});
