import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import MetaballCanvas from '../src/components/MetaballCanvas';
import { DEFAULT_PRESET, clonePreset } from '../src/lib/model';

const noop = () => {};
const rasterTheme = clonePreset(DEFAULT_PRESET).theme;

function renderRaster(showGrid: boolean): string {
  const doc = clonePreset(DEFAULT_PRESET);
  return renderToStaticMarkup(
    createElement(MetaballCanvas, {
      mode: 'metaball',
      nodes: doc.nodes,
      edges: doc.edges,
      theme: doc.theme,
      showGrid,
      fullGrid: doc.fullGrid,
      gooStd: doc.gooStd,
      gooThreshold: doc.gooThreshold,
      tubeFactor: doc.tubeFactor,
      inwardPull: doc.inwardPull,
      edgeFactors: doc.edgeFactors,
      edgePulls: doc.edgePulls,
      selected: null,
      selectedEdge: null,
      exportPreviewPath: null,
      onAddNode: noop,
      onSelect: noop,
      onSelectEdge: noop,
      onToggleEdge: noop,
      onRemoveNode: noop,
      onMoveNode: noop,
    }),
  );
}

test('the Namche raster toggle removes all raster colors from the 2D SVG', () => {
  const enabled = renderRaster(true);
  const disabled = renderRaster(false);

  assert.match(enabled, new RegExp(rasterTheme.pink));
  assert.match(enabled, new RegExp(rasterTheme.blue));
  assert.doesNotMatch(disabled, new RegExp(rasterTheme.pink));
  assert.doesNotMatch(disabled, new RegExp(rasterTheme.blue));
});
