import assert from 'node:assert/strict';
import test from 'node:test';
import React, { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { DEFAULT_PRESET, clonePreset, type Mode } from '../src/lib/model';
import { DEFAULT_AI_ENHANCE, DEFAULT_AI_RENDER_PARAMS } from '../lib/ai-render-contract';
import type {
  MarkPanelProps,
  ObjectPanelProps,
  SelectedEdge,
  SelectedNode,
} from '../src/components/panels/types';
import type { AIRenderSession } from '../src/lib/useAIRenders';

// The test runner transpiles JSX with the classic runtime; Vite uses the automatic runtime.
(globalThis as typeof globalThis & { React: typeof React }).React = React;

// Base UI tabs only render the active panel, so each tab is rendered on its
// own; the panels themselves are checked for the numbered step list.
const { default: Toolbar } = await import('../src/components/Toolbar');
const { MarkShapeTab } = await import('../src/components/panels/ShapeTab');
const { StyleTab } = await import('../src/components/panels/StyleTab');
const { ExportTab } = await import('../src/components/panels/ExportTab');
const { SurfaceTab } = await import('../src/components/panels/SurfaceTab');
const { SceneTab } = await import('../src/components/panels/SceneTab');
const { default: AIRenderPanel } = await import('../src/components/AIRenderPanel');
const { fileMenuItems } = await import('../src/components/toolbar/file-menu-items');

const noop = () => {};
const doc = clonePreset(DEFAULT_PRESET);

const form = {
  values: {
    tubeFactor: doc.tubeFactor,
    gooStd: doc.gooStd,
    gooThreshold: doc.gooThreshold,
    inwardPull: doc.inwardPull,
  },
  scrub: noop,
  commit: noop,
};
const presets = { activePresetId: 'loop', onApply: noop };

function markProps(
  mode: Mode,
  selection: { node?: SelectedNode | null; edge?: SelectedEdge | null } = {},
): MarkPanelProps {
  return {
    selectionId: null,
    shape: {
      mode,
      presets,
      form,
      node: selection.node ?? null,
      edge: selection.edge ?? null,
      fullGrid: doc.fullGrid,
      onFullGridChange: noop,
    },
    style: {
      theme: doc.theme,
      onThemeChange: noop,
      onThemeCommit: noop,
      rasterEnabled: doc.rasterEnabled,
      onRasterEnabledChange: noop,
    },
    export: {
      mode,
      markOnly: false,
      onMarkOnlyChange: noop,
      pngScale: 4,
      onPngScaleChange: noop,
      onExportSvg: noop,
      onExportPng: noop,
      onCopySvg: async () => true,
      showExportPreview: false,
      onShowExportPreviewChange: noop,
      flattenEpsilon: doc.flattenEpsilon,
      flattenResolution: doc.flattenResolution,
      onFlattenScrub: noop,
      onFlattenCommit: noop,
    },
  };
}

const session: AIRenderSession = {
  params: DEFAULT_AI_RENDER_PARAMS,
  setParams: noop,
  patch: noop,
  patchMetamorph: noop,
  status: 'idle',
  error: null,
  suggesting: false,
  suggest: async () => {},
  render: async () => {},
  entries: [],
  selected: null,
  select: noop,
  showRender: false,
  setShowRender: noop,
  enhance: { ...DEFAULT_AI_ENHANCE },
  setEnhance: noop,
  enhancingId: null,
  runEnhance: async () => {},
};

function objectProps(lookMode: 'material' | 'liquid' = 'material'): ObjectPanelProps {
  const scene = { lighting: 'soft', background: 'studio', canvas: 'opaque' as const };
  return {
    shape: { presets, form },
    surface: {
      lookMode,
      onLookModeChange: noop,
      material: {
        preset: doc.materialPreset,
        onPresetChange: noop,
        textureSlug: null,
        onTextureSlugChange: noop,
        textureScale: doc.textureScale,
        onTextureScaleChange: noop,
        textureAmount: doc.textureAmount,
        onTextureAmountChange: noop,
      },
      liquid: {
        preset: doc.liquidPreset,
        onPresetChange: noop,
        params: doc.liquidParams,
        onParamsScrub: noop,
        onParamsCommit: noop,
      },
      sampler: {
        values: {
          surfaceSamplerEnabled: doc.surfaceSamplerEnabled,
          surfaceSamplerMode: doc.surfaceSamplerMode,
          surfaceSamplerCount: doc.surfaceSamplerCount,
          surfaceSamplerPointSize: doc.surfaceSamplerPointSize,
          surfaceSamplerSphereSize: doc.surfaceSamplerSphereSize,
          surfaceSamplerShowMesh: doc.surfaceSamplerShowMesh,
          surfaceSamplerAnimate: doc.surfaceSamplerAnimate,
        },
        set: noop,
        scrub: noop,
        commit: noop,
      },
    },
    scene: {
      scene,
      onSceneChange: noop,
      lookMode,
      liquidBackdrop: doc.liquidBackdrop,
      onLiquidBackdropChange: noop,
    },
    render: {
      session,
      canRender: true,
      scene,
      textureSlug: null,
      referenceName: null,
      onAttachReference: noop,
      onClearReference: noop,
      onSavePrompt: async () => {
        throw new Error('not in tests');
      },
      onApplyPrompt: noop,
    },
  };
}

const html = <P extends object>(component: React.ComponentType<P>, props: P) =>
  renderToStaticMarkup(createElement(component, props));

type ToolbarProps = ComponentProps<typeof Toolbar>;
const history = { canUndo: false, canRedo: false, onUndo: noop, onRedo: noop };
const file = { onImportJson: noop, onExportJson: noop, onClear: noop };

function renderMarkTabs(mode: Mode = 'metaball', selection = {}): string {
  const props = markProps(mode, selection);
  return [
    html(MarkShapeTab, props.shape),
    html(StyleTab, props.style),
    html(ExportTab, props.export),
  ].join('\n');
}

function renderObjectTabs(lookMode: 'material' | 'liquid' = 'material'): string {
  const props = objectProps(lookMode);
  return [
    html(SurfaceTab, props.surface),
    html(SceneTab, props.scene),
    html(AIRenderPanel, props.render),
  ].join('\n');
}

test('Mark toolbar shows the Brand Studio app bar and numbered Mark steps', () => {
  const markup = html(Toolbar, {
    view: '2d',
    history,
    file,
    panel: markProps('metaball'),
  } satisfies ToolbarProps);
  assert.match(markup, /NAMCHE/);
  assert.match(markup, /Brand Studio/);
  assert.match(markup, /\/namche-mark\.svg/);
  assert.doesNotMatch(markup, /Frontier AI Initiative/);
  assert.match(markup, />File</);
  assert.match(markup, />Shape</);
  assert.match(markup, />Style</);
  assert.match(markup, />Export</);
  assert.doesNotMatch(markup, />Surface</);
  // Form | Graph moved from the app bar onto the stage.
  assert.doesNotMatch(markup, />Form</);
  // Credits stay in the Studio panel.
  assert.match(markup, /Michael Marte/);
  assert.match(markup, /Ruhm etc\./);
});

test('Object toolbar shows the four Object steps', () => {
  const markup = html(Toolbar, {
    view: '3d',
    history,
    file,
    panel: objectProps(),
  } satisfies ToolbarProps);
  for (const step of ['Shape', 'Surface', 'Scene', 'Render']) {
    assert.match(markup, new RegExp(`>${step}<`));
  }
  assert.match(markup, /Michael Marte/);
});

test('2D exposes flat appearance and raster controls, not materials', () => {
  const markup = renderMarkTabs();
  assert.match(markup, /Namche raster/);
  assert.match(markup, /Export SVG/);
  assert.doesNotMatch(markup, />Organic</);
  assert.doesNotMatch(markup, /Surface sampling/);
  assert.doesNotMatch(markup, /Render with AI/);
});

test('3D exposes materials, sampling and the AI render, not raster controls', () => {
  const markup = renderObjectTabs();
  assert.match(markup, />Organic</);
  assert.match(markup, />Liquid</);
  assert.match(markup, /Surface sampling/);
  assert.match(markup, /Render with AI/);
  assert.match(markup, /the AI render uses exactly this camera view/);
  assert.doesNotMatch(markup, /Namche raster/);
  assert.doesNotMatch(markup, />Form</);
});

test('Liquid surface offers its fine-tuning and a scene environment', () => {
  const markup = renderObjectTabs('liquid');
  assert.match(markup, /Fine-tune liquid/);
  assert.match(markup, /Environment/);
});

test('Graph view suppresses vector export actions', () => {
  const markup = renderMarkTabs('graph');
  assert.doesNotMatch(markup, /Export SVG/);
  assert.match(markup, /Switch to Form to export SVG or PNG/);
});

test('Selection cards appear at the top of Shape only while something is selected', () => {
  const idle = html(MarkShapeTab, markProps('metaball').shape);
  assert.doesNotMatch(idle, /Selected node/);
  assert.doesNotMatch(idle, /Selected connection/);

  const node: SelectedNode = {
    size: 'M',
    radius: 40,
    radiusOverridden: false,
    radiusMin: 1,
    radiusMax: 100,
    onSizeChange: noop,
    onRadiusChange: noop,
    onRadiusCommit: noop,
    onRadiusReset: noop,
    onDelete: noop,
  };
  const withNode = html(MarkShapeTab, markProps('metaball', { node }).shape);
  assert.match(withNode, /Selected node/);
  assert.ok(withNode.indexOf('Selected node') < withNode.indexOf('Shape presets'));

  const edge: SelectedEdge = {
    factor: 0.5,
    factorOverridden: false,
    pull: 0.5,
    pullOverridden: false,
    onFactorChange: noop,
    onFactorCommit: noop,
    onFactorReset: noop,
    onPullChange: noop,
    onPullCommit: noop,
    onPullReset: noop,
    onEnableStyle: noop,
    onDisableStyle: noop,
    onRemove: noop,
  };
  const form = html(MarkShapeTab, markProps('metaball', { edge }).shape);
  assert.match(form, /Customize this connection/);
  const graph = html(MarkShapeTab, markProps('graph', { edge }).shape);
  assert.match(graph, /Remove connection/);
  assert.doesNotMatch(graph, /Customize this connection/);
});

test('File menu offers GLB and Blender export only in 3D', () => {
  const ids2d = fileMenuItems('2d').map((item) => item.id);
  const ids3d = fileMenuItems('3d').map((item) => item.id);
  for (const ids of [ids2d, ids3d]) {
    assert.ok(ids.includes('import-json'));
    assert.ok(ids.includes('export-json'));
    assert.equal(ids.at(-1), 'clear');
  }
  assert.ok(!ids2d.includes('export-glb'));
  assert.ok(!ids2d.includes('export-blender'));
  assert.ok(ids3d.includes('export-glb'));
  assert.ok(ids3d.includes('export-blender'));
});
