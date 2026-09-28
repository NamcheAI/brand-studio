import {
  ENGINE,
  buildRenderData,
  cellCenter,
  cellRect,
  clamp01,
  clampOffset,
  clampRadius,
  edgeKey,
  effectiveBlur,
  isInner,
  isPlaceable,
  nodeCenter,
  nodeKey,
  nodeRadius,
  parseKey,
  type Edge,
  type EditorDoc,
  type Mode,
  type Node,
  type Preset,
  type RenderData,
  type Size,
  type Theme,
} from '@namche/metaball';
import {
  DEFAULT_LIQUID_PRESET,
  cloneLiquidParams,
  defaultLiquidParams,
  type LiquidParams,
  type LookMode,
} from './liquidPresets';
import { DEFAULT_LIQUID_BACKDROP } from './liquidBackdrops';

const {
  CELL,
  DEFAULT_FLATTEN_EPSILON,
  DEFAULT_FLATTEN_RESOLUTION,
  DEFAULT_GOO_STD,
  DEFAULT_GOO_THRESHOLD,
  DEFAULT_THEME,
  DEFAULT_TUBE_FACTOR,
  EDITOR_PRESET_IDS,
  GRID,
  OFFSET_LIMIT,
  PRESETS: CORE_PRESETS,
  RADIUS_MAX,
  RADIUS_MIN,
  VIEWBOX,
} = ENGINE;

export {
  CELL,
  RADIUS_MAX,
  RADIUS_MIN,
  cellCenter,
  cellRect,
  clampOffset,
  clampRadius,
  edgeKey,
  isInner,
};
export type { Edge, Mode, Size, Theme };
export type { LiquidParams, LookMode };
export { DEFAULT_LIQUID_PRESET, cloneLiquidParams, defaultLiquidParams };
export { DEFAULT_LIQUID_BACKDROP };

/**
 * Compatibility names for Michael's editor. Every 2D operation delegates to
 * @namche/metaball so preview, export, baked assets, and design-system copies
 * all use one geometry implementation.
 */
export type GridNode = Node;
export type NodeId = string;
export type MetaballShapes = RenderData;

export const COLS = GRID;
export const ROWS = GRID;
export const SVG_SIZE = VIEWBOX;
export const OFFSET_MAX = OFFSET_LIMIT;
export const DOT_RADIUS = CELL * 0.06;
export const GRAPH_STROKE = CELL * 0.3;

export const GOO_STD = DEFAULT_GOO_STD;
export const GOO_STD_MIN = CELL * 0.02;
export const GOO_STD_MAX = CELL * 0.18;
export const GOO_THRESHOLD = DEFAULT_GOO_THRESHOLD;
export const GOO_THRESHOLD_MIN = 6;
export const GOO_THRESHOLD_MAX = 44;
export const TUBE_RADIUS_FACTOR = DEFAULT_TUBE_FACTOR;
export const TUBE_FACTOR_MIN = 0.1;
export const TUBE_FACTOR_MAX = 1;
export const INWARD_PULL = 0;
export const INWARD_PULL_MIN = 0;
export const INWARD_PULL_MAX = 1;

export const FLATTEN_EPSILON = DEFAULT_FLATTEN_EPSILON;
export const FLATTEN_EPSILON_MIN = 0.1;
export const FLATTEN_EPSILON_MAX = 3;
export const FLATTEN_RESOLUTION = DEFAULT_FLATTEN_RESOLUTION;
export const FLATTEN_RESOLUTION_MIN = 1;
export const FLATTEN_RESOLUTION_MAX = 3;

export const PNG_SCALES = [1, 2, 4, 8] as const;
export type PngScale = (typeof PNG_SCALES)[number];

export const nodeId = nodeKey;
export const parseNodeId = parseKey;
export const nodePosition = nodeCenter;
export const effectiveNodeRadius = nodeRadius;
export const isEditableCell = isPlaceable;
export const getMetaballShapes = buildRenderData;
export const inwardGooStd = effectiveBlur;
export const inwardTubeScale = (pull: number): number => 1 - clamp01(pull);

export function edgeTubeFactor(
  a: NodeId,
  b: NodeId,
  globalFactor: number,
  overrides?: Record<string, number>,
): number {
  return overrides?.[edgeKey(a, b)] ?? globalFactor;
}

export function edgePull(
  a: NodeId,
  b: NodeId,
  globalPull: number,
  overrides?: Record<string, number>,
): number {
  return overrides?.[edgeKey(a, b)] ?? globalPull;
}

/**
 * The canvas theme is CONTENT, not chrome: it is stored in the document and it
 * is what an export looks like. Day is the engine default (white ground, black
 * mark, the Namche raster at full strength). Night is its counterpart on the
 * design system's night ground.
 *
 * Night is derived, not invented — `@namche/design-tokens` ships no dark raster
 * pair. Ground and ink are the tokens themselves (`--gaia-erebos`,
 * `--gaia-selene`). The two raster cells keep the exact hue of
 * `--namche-raster-pink` (297°) and `--namche-raster-cyan` (196°) and are
 * re-placed at S 30% / L 28%, which lands each one on the night surface ramp:
 * #5B325D sits at --night-line's luminance, #32515D at --night-control's.
 * Selene ink clears 8.9:1 and 7.4:1 on them.
 */
export const DAY_THEME: Theme = DEFAULT_THEME;
export const NIGHT_THEME: Theme = {
  /** raster-pink hue on the night ramp (≈ --night-line) */
  pink: '#5B325D',
  /** raster-cyan hue on the night ramp (≈ --night-control) */
  blue: '#32515D',
  /** --gaia-selene */
  ink: '#F1EFE8',
  /** --gaia-erebos */
  bg: '#262626',
};

export type ThemePreset = { id: string; label: string; theme: Theme };
export const THEME_PRESETS: ThemePreset[] = [
  { id: 'default', label: 'Namche raster', theme: DAY_THEME },
  { id: 'night', label: 'Namche raster, night', theme: NIGHT_THEME },
];

export type CanvasThemeId = 'day' | 'night';
export const CANVAS_THEMES: Record<CanvasThemeId, Theme> = {
  day: DAY_THEME,
  night: NIGHT_THEME,
};

const sameColor = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();
const sameTheme = (a: Theme, b: Theme): boolean =>
  sameColor(a.bg, b.bg) &&
  sameColor(a.ink, b.ink) &&
  sameColor(a.pink, b.pink) &&
  sameColor(a.blue, b.blue);

/** Which canvas preset this theme is, exactly; `null` once any color is edited. */
export function canvasThemeId(theme: Theme): CanvasThemeId | null {
  if (sameTheme(theme, DAY_THEME)) return 'day';
  if (sameTheme(theme, NIGHT_THEME)) return 'night';
  return null;
}

const DEFAULT_EDITOR_PRESET_ID = 'loop';
export const PRESETS: Preset[] = EDITOR_PRESET_IDS.flatMap((id) => {
  const preset = CORE_PRESETS.find((candidate) => candidate.id === id);
  return preset ? [preset] : [];
});
export const DEFAULT_PRESET =
  PRESETS.find((preset) => preset.id === DEFAULT_EDITOR_PRESET_ID) ?? PRESETS[0]!;

export const DEFAULT_MATERIAL_PRESET = 'wax';

export type SurfaceSamplerMode = 'points' | 'spheres' | 'both';
export const SURFACE_SAMPLER_ENABLED = false;
export const SURFACE_SAMPLER_MODE: SurfaceSamplerMode = 'both';
export const SURFACE_SAMPLER_COUNT = 3000;
export const SURFACE_SAMPLER_COUNT_MIN = 100;
export const SURFACE_SAMPLER_COUNT_MAX = 15000;
export const SURFACE_SAMPLER_POINT_SIZE = 0.04;
export const SURFACE_SAMPLER_POINT_SIZE_MIN = 0.005;
export const SURFACE_SAMPLER_POINT_SIZE_MAX = 0.12;
export const SURFACE_SAMPLER_SPHERE_SIZE = 0.028;
export const SURFACE_SAMPLER_SPHERE_SIZE_MIN = 0.004;
export const SURFACE_SAMPLER_SPHERE_SIZE_MAX = 0.08;
export const SURFACE_SAMPLER_SHOW_MESH = true;
export const SURFACE_SAMPLER_ANIMATE = true;

export const clampSurfaceSamplerCount = (value: number): number =>
  Math.min(SURFACE_SAMPLER_COUNT_MAX, Math.max(SURFACE_SAMPLER_COUNT_MIN, Math.round(value)));
export const clampSurfaceSamplerPointSize = (value: number): number =>
  Math.min(SURFACE_SAMPLER_POINT_SIZE_MAX, Math.max(SURFACE_SAMPLER_POINT_SIZE_MIN, value));
export const clampSurfaceSamplerSphereSize = (value: number): number =>
  Math.min(SURFACE_SAMPLER_SPHERE_SIZE_MAX, Math.max(SURFACE_SAMPLER_SPHERE_SIZE_MIN, value));

export function normalizeSurfaceSamplerMode(value: unknown): SurfaceSamplerMode {
  return value === 'points' || value === 'spheres' || value === 'both'
    ? value
    : SURFACE_SAMPLER_MODE;
}

export const TEXTURE_SCALE_MIN = 0.4;
export const TEXTURE_SCALE_MAX = 6;
export const TEXTURE_SCALE = 1.6;
export const TEXTURE_AMOUNT = 1;

export const clampTextureScale = (value: number): number =>
  Math.min(TEXTURE_SCALE_MAX, Math.max(TEXTURE_SCALE_MIN, value));

export const clampTextureAmount = (value: number): number =>
  Math.min(1, Math.max(0, value));

export type Document = EditorDoc & {
  materialPreset: string;
  /** Curated imagery slug for the triplanar surface texture; null = off. */
  textureSlug: string | null;
  textureScale: number;
  textureAmount: number;
  lookMode: LookMode;
  liquidPreset: string;
  liquidParams: LiquidParams;
  liquidBackdrop: string;
  surfaceSamplerEnabled: boolean;
  surfaceSamplerMode: SurfaceSamplerMode;
  surfaceSamplerCount: number;
  surfaceSamplerPointSize: number;
  surfaceSamplerSphereSize: number;
  surfaceSamplerShowMesh: boolean;
  surfaceSamplerAnimate: boolean;
};

export const DOCUMENT_VERSION = 12;
export type StoredDocument = Document & { version: number };

export function createDefaultDocument(nodes: GridNode[] = [], edges: Edge[] = []): Document {
  return {
    nodes,
    edges,
    edgeFactors: {},
    edgePulls: {},
    mode: 'metaball',
    theme: { ...DEFAULT_THEME },
    rasterEnabled: true,
    gooStd: GOO_STD,
    gooThreshold: GOO_THRESHOLD,
    tubeFactor: TUBE_RADIUS_FACTOR,
    inwardPull: INWARD_PULL,
    fullGrid: false,
    flattenEpsilon: FLATTEN_EPSILON,
    flattenResolution: FLATTEN_RESOLUTION,
    materialPreset: DEFAULT_MATERIAL_PRESET,
    textureSlug: null,
    textureScale: TEXTURE_SCALE,
    textureAmount: TEXTURE_AMOUNT,
    lookMode: 'material',
    liquidPreset: DEFAULT_LIQUID_PRESET,
    liquidParams: defaultLiquidParams(),
    liquidBackdrop: DEFAULT_LIQUID_BACKDROP,
    surfaceSamplerEnabled: SURFACE_SAMPLER_ENABLED,
    surfaceSamplerMode: SURFACE_SAMPLER_MODE,
    surfaceSamplerCount: SURFACE_SAMPLER_COUNT,
    surfaceSamplerPointSize: SURFACE_SAMPLER_POINT_SIZE,
    surfaceSamplerSphereSize: SURFACE_SAMPLER_SPHERE_SIZE,
    surfaceSamplerShowMesh: SURFACE_SAMPLER_SHOW_MESH,
    surfaceSamplerAnimate: SURFACE_SAMPLER_ANIMATE,
  };
}

export function clonePreset(preset: Preset): Document {
  const doc = createDefaultDocument(
    preset.nodes.map((node) => ({ ...node })),
    preset.edges.map(([a, b]) => [a, b]),
  );
  if (preset.tubeFactor !== undefined) doc.tubeFactor = preset.tubeFactor;
  if (preset.gooStd !== undefined) doc.gooStd = preset.gooStd;
  if (preset.gooThreshold !== undefined) doc.gooThreshold = preset.gooThreshold;
  if (preset.fullGrid !== undefined) doc.fullGrid = preset.fullGrid;
  return doc;
}

/** Apply a shape preset without resetting raster, material, or other studio preferences. */
export function applyPresetShape(doc: Document, preset: Preset): Document {
  const shape = clonePreset(preset);
  return {
    ...cloneDocument(doc),
    nodes: shape.nodes,
    edges: shape.edges,
    edgeFactors: shape.edgeFactors,
    edgePulls: shape.edgePulls,
    gooStd: shape.gooStd,
    gooThreshold: shape.gooThreshold,
    tubeFactor: shape.tubeFactor,
    inwardPull: shape.inwardPull,
    fullGrid: shape.fullGrid,
    flattenEpsilon: shape.flattenEpsilon,
    flattenResolution: shape.flattenResolution,
  };
}

const sameNode = (a: GridNode, b: GridNode): boolean =>
  a.r === b.r &&
  a.c === b.c &&
  a.size === b.size &&
  a.radius === b.radius &&
  a.offsetX === b.offsetX &&
  a.offsetY === b.offsetY;

function matchesPreset(doc: Document, preset: Preset): boolean {
  if (doc.nodes.length !== preset.nodes.length || doc.edges.length !== preset.edges.length) {
    return false;
  }
  const nodes = [...doc.nodes].sort((a, b) => nodeId(a.r, a.c).localeCompare(nodeId(b.r, b.c)));
  const presetNodes = [...preset.nodes].sort((a, b) =>
    nodeId(a.r, a.c).localeCompare(nodeId(b.r, b.c)),
  );
  const edges = doc.edges.map(([a, b]) => edgeKey(a, b)).sort();
  const presetEdges = preset.edges.map(([a, b]) => edgeKey(a, b)).sort();
  return (
    nodes.every((node, index) => sameNode(node, presetNodes[index])) &&
    edges.every((edge, index) => edge === presetEdges[index]) &&
    Object.keys(doc.edgeFactors).length === 0 &&
    Object.keys(doc.edgePulls).length === 0 &&
    doc.tubeFactor === (preset.tubeFactor ?? TUBE_RADIUS_FACTOR) &&
    doc.gooStd === (preset.gooStd ?? GOO_STD) &&
    doc.gooThreshold === (preset.gooThreshold ?? GOO_THRESHOLD) &&
    doc.inwardPull === INWARD_PULL &&
    doc.fullGrid === (preset.fullGrid ?? false) &&
    doc.flattenEpsilon === FLATTEN_EPSILON &&
    doc.flattenResolution === FLATTEN_RESOLUTION
  );
}

/** The untouched shape preset represented by this document, if any. */
export function presetIdForDocument(doc: Document): string | null {
  return CORE_PRESETS.find((preset) => matchesPreset(doc, preset))?.id ?? null;
}

export function cloneDocument(doc: Document): Document {
  return {
    ...doc,
    theme: { ...doc.theme },
    nodes: doc.nodes.map((node) => ({ ...node })),
    edges: doc.edges.map(([a, b]) => [a, b]),
    edgeFactors: { ...doc.edgeFactors },
    edgePulls: { ...doc.edgePulls },
    liquidParams: cloneLiquidParams(doc.liquidParams),
  };
}

export function remapEdgeRecord<T>(
  record: Record<string, T>,
  from: NodeId,
  to: NodeId,
): Record<string, T> {
  const next: Record<string, T> = {};
  for (const [key, value] of Object.entries(record)) {
    next[
      key
        .split('|')
        .map((part) => (part === from ? to : part))
        .sort()
        .join('|')
    ] = value;
  }
  return next;
}

export const filterEdgeRecordByNode = <T>(
  record: Record<string, T>,
  id: NodeId,
): Record<string, T> =>
  Object.fromEntries(Object.entries(record).filter(([key]) => !key.split('|').includes(id)));

export const omitEdgeRecordKey = <T>(record: Record<string, T>, key: string): Record<string, T> =>
  Object.fromEntries(Object.entries(record).filter(([entry]) => entry !== key));
