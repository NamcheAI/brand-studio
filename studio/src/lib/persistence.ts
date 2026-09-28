import {
  DOCUMENT_VERSION,
  DEFAULT_PRESET,
  FLATTEN_EPSILON_MAX,
  FLATTEN_EPSILON_MIN,
  FLATTEN_RESOLUTION_MAX,
  FLATTEN_RESOLUTION_MIN,
  GOO_STD_MAX,
  GOO_STD_MIN,
  GOO_THRESHOLD_MAX,
  GOO_THRESHOLD_MIN,
  INWARD_PULL_MAX,
  INWARD_PULL_MIN,
  OFFSET_MAX,
  PRESETS,
  RADIUS_MAX,
  RADIUS_MIN,
  TUBE_FACTOR_MAX,
  TUBE_FACTOR_MIN,
  CANVAS_THEMES,
  type CanvasThemeId,
  clampSurfaceSamplerCount,
  clampSurfaceSamplerPointSize,
  clampSurfaceSamplerSphereSize,
  cloneDocument,
  clonePreset,
  createDefaultDocument,
  edgeKey,
  nodeId,
  normalizeSurfaceSamplerMode,
  type Document,
  type Edge,
  type GridNode,
  type Size,
  type StoredDocument,
  type Theme,
  clampTextureScale,
  clampTextureAmount,
} from './model';
import {
  DEFAULT_LIQUID_PRESET,
  defaultLiquidParams,
  getLiquidPreset,
  normalizeLiquidParams,
  normalizeLookMode,
} from './liquidPresets';
import { normalizeLiquidBackdropId } from './liquidBackdrops';
import { getMaterialPreset } from './materialPresets';
import { isTextureSlug } from './texturePresets';

export const STORAGE_KEY = 'namche-studio-document';
const LEGACY_STORAGE_KEY = 'metaball-editor-document';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
const finiteOr = (value: unknown, fallback: number, min: number, max: number): number =>
  isFiniteNumber(value) ? clamp(value, min, max) : fallback;
const isHexColor = (value: unknown): value is string =>
  typeof value === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(value);

const LEGACY_BRANDMARK_NODE_IDS = new Set(['0-0', '0-4', '2-2', '4-0', '4-4']);
const LEGACY_BRANDMARK_EDGES = new Set([
  edgeKey('0-0', '0-4'),
  edgeKey('0-4', '4-4'),
  edgeKey('4-0', '4-4'),
  edgeKey('2-2', '4-0'),
]);
const LEGACY_TO_INNER_NODE: Record<string, string> = {
  '0-0': '1-1',
  '0-4': '1-3',
  '2-2': '2-2',
  '4-0': '3-1',
  '4-4': '3-3',
};

function isLegacyFullBleedBrandmark(doc: Document): boolean {
  if (!doc.fullGrid || doc.nodes.length !== 5 || doc.edges.length !== 4) return false;
  if (!doc.nodes.every((node) => LEGACY_BRANDMARK_NODE_IDS.has(nodeId(node.r, node.c)))) {
    return false;
  }
  if (!doc.edges.every(([a, b]) => LEGACY_BRANDMARK_EDGES.has(edgeKey(a, b)))) return false;

  return doc.nodes.every((node) => {
    const horizontalSign = node.c === 0 ? 1 : node.c === 4 ? -1 : 0;
    const verticalSign = node.r === 0 ? 1 : node.r === 4 ? -1 : 0;
    return (
      node.size === 'L' &&
      node.radius === 89.55 &&
      (node.offsetX ?? 0) === horizontalSign * 25.55 &&
      (node.offsetY ?? 0) === verticalSign * 25.55
    );
  });
}

function remapLegacyEdgeRecord(record: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key
        .split('|')
        .map((id) => LEGACY_TO_INNER_NODE[id] ?? id)
        .sort()
        .join('|'),
      value,
    ]),
  );
}

function migrateLegacyBrandmark(doc: Document): Document {
  const preset = PRESETS.find(({ id }) => id === 'brandmark');
  if (!preset) return doc;
  return {
    ...doc,
    nodes: preset.nodes.map((node) => ({ ...node })),
    edges: preset.edges.map(([a, b]): Edge => [a, b]),
    edgeFactors: remapLegacyEdgeRecord(doc.edgeFactors),
    edgePulls: remapLegacyEdgeRecord(doc.edgePulls),
    fullGrid: false,
  };
}

function sanitizeNode(value: unknown): GridNode | null {
  if (!isRecord(value)) return null;
  if (
    !Number.isInteger(value.r) ||
    !Number.isInteger(value.c) ||
    (value.r as number) < 0 ||
    (value.r as number) >= 5 ||
    (value.c as number) < 0 ||
    (value.c as number) >= 5
  ) {
    return null;
  }
  const size: Size =
    value.size === 'S' || value.size === 'M' || value.size === 'L' || value.size === 'XL'
      ? value.size
      : 'M';
  const node: GridNode = { r: value.r as number, c: value.c as number, size };
  if (isFiniteNumber(value.radius)) node.radius = clamp(value.radius, RADIUS_MIN, RADIUS_MAX);
  if (isFiniteNumber(value.offsetX)) node.offsetX = clamp(value.offsetX, -OFFSET_MAX, OFFSET_MAX);
  if (isFiniteNumber(value.offsetY)) node.offsetY = clamp(value.offsetY, -OFFSET_MAX, OFFSET_MAX);
  return node;
}

function sanitizeNodes(value: unknown): GridNode[] {
  if (!Array.isArray(value)) return [];
  const byCell = new Map<string, GridNode>();
  for (const raw of value.slice(0, 25)) {
    const node = sanitizeNode(raw);
    if (node) byCell.set(nodeId(node.r, node.c), node);
  }
  return [...byCell.values()];
}

function sanitizeEdges(value: unknown, nodeIds: Set<string>): Edge[] {
  if (!Array.isArray(value)) return [];
  const byKey = new Map<string, Edge>();
  for (const raw of value.slice(0, 300)) {
    if (!Array.isArray(raw) || raw.length !== 2) continue;
    const [a, b] = raw;
    if (typeof a !== 'string' || typeof b !== 'string' || a === b) continue;
    if (!nodeIds.has(a) || !nodeIds.has(b)) continue;
    byKey.set(edgeKey(a, b), [a, b]);
  }
  return [...byKey.values()];
}

function sanitizeEdgeRecord(
  value: unknown,
  validEdges: Set<string>,
  min: number,
  max: number,
): Record<string, number> {
  if (!isRecord(value)) return {};
  const result: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (validEdges.has(key) && isFiniteNumber(entry)) result[key] = clamp(entry, min, max);
  }
  return result;
}

function sanitizeTheme(value: unknown, fallback: Theme): Theme {
  if (!isRecord(value)) return { ...fallback };
  return {
    pink: isHexColor(value.pink) ? value.pink : fallback.pink,
    blue: isHexColor(value.blue) ? value.blue : fallback.blue,
    ink: isHexColor(value.ink) ? value.ink : fallback.ink,
    bg: isHexColor(value.bg) ? value.bg : fallback.bg,
  };
}

export function saveDocument(doc: Document): void {
  try {
    const stored: StoredDocument = {
      ...cloneDocument(doc),
      version: DOCUMENT_VERSION,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage can be unavailable in private contexts or full.
  }
}

export function loadDocument(): Document | null {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      // The rename moved the key; fall back to the pre-rename one so a
      // returning visitor's document survives, then migrate it forward.
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy !== null) {
        raw = legacy;
        localStorage.setItem(STORAGE_KEY, legacy);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    }
    return raw ? normalizeDocument(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function normalizeDocument(input: unknown): Document {
  const base = createDefaultDocument();
  if (!isRecord(input)) return base;
  const storedVersion = isFiniteNumber(input.version) ? input.version : 0;

  const nodes = sanitizeNodes(input.nodes);
  const nodeIds = new Set(nodes.map((node) => nodeId(node.r, node.c)));
  const edges = sanitizeEdges(input.edges, nodeIds);
  const validEdges = new Set(edges.map(([a, b]) => edgeKey(a, b)));

  const legacyPrism = input.materialPreset === 'prism';
  const lookMode = legacyPrism ? 'liquid' : normalizeLookMode(input.lookMode);
  const requestedLiquidPreset =
    typeof input.liquidPreset === 'string'
      ? input.liquidPreset
      : legacyPrism
        ? 'prism'
        : base.liquidPreset;
  const liquidPreset = getLiquidPreset(requestedLiquidPreset).id;
  const liquidFallback = getLiquidPreset(liquidPreset).params;
  const liquidParams = normalizeLiquidParams(
    isRecord(input.liquidParams) ? input.liquidParams : undefined,
    legacyPrism ? defaultLiquidParams() : liquidFallback,
  );

  let materialPreset =
    typeof input.materialPreset === 'string' ? input.materialPreset : base.materialPreset;
  if (materialPreset === 'prism') materialPreset = 'wax';
  materialPreset = getMaterialPreset(materialPreset).id;

  const normalized: Document = {
    nodes,
    edges,
    edgeFactors: sanitizeEdgeRecord(
      input.edgeFactors,
      validEdges,
      TUBE_FACTOR_MIN,
      TUBE_FACTOR_MAX,
    ),
    edgePulls: sanitizeEdgeRecord(input.edgePulls, validEdges, INWARD_PULL_MIN, INWARD_PULL_MAX),
    mode: input.mode === 'graph' ? 'graph' : 'metaball',
    theme: sanitizeTheme(input.theme, base.theme),
    rasterEnabled:
      typeof input.rasterEnabled === 'boolean' ? input.rasterEnabled : base.rasterEnabled,
    gooStd: finiteOr(input.gooStd, base.gooStd, GOO_STD_MIN, GOO_STD_MAX),
    gooThreshold: finiteOr(
      input.gooThreshold,
      base.gooThreshold,
      GOO_THRESHOLD_MIN,
      GOO_THRESHOLD_MAX,
    ),
    tubeFactor: finiteOr(input.tubeFactor, base.tubeFactor, TUBE_FACTOR_MIN, TUBE_FACTOR_MAX),
    inwardPull: finiteOr(input.inwardPull, base.inwardPull, INWARD_PULL_MIN, INWARD_PULL_MAX),
    fullGrid: input.fullGrid === true,
    flattenEpsilon: finiteOr(
      input.flattenEpsilon,
      base.flattenEpsilon,
      FLATTEN_EPSILON_MIN,
      FLATTEN_EPSILON_MAX,
    ),
    flattenResolution: Math.round(
      finiteOr(
        input.flattenResolution,
        base.flattenResolution,
        FLATTEN_RESOLUTION_MIN,
        FLATTEN_RESOLUTION_MAX,
      ),
    ),
    materialPreset,
    textureSlug: isTextureSlug(input.textureSlug) ? input.textureSlug : null,
    textureScale: isFiniteNumber(input.textureScale)
      ? clampTextureScale(input.textureScale)
      : base.textureScale,
    textureAmount: isFiniteNumber(input.textureAmount)
      ? clampTextureAmount(input.textureAmount)
      : base.textureAmount,
    lookMode,
    liquidPreset: liquidPreset || DEFAULT_LIQUID_PRESET,
    liquidParams,
    liquidBackdrop: normalizeLiquidBackdropId(input.liquidBackdrop),
    surfaceSamplerEnabled:
      typeof input.surfaceSamplerEnabled === 'boolean'
        ? input.surfaceSamplerEnabled
        : base.surfaceSamplerEnabled,
    surfaceSamplerMode: normalizeSurfaceSamplerMode(input.surfaceSamplerMode),
    surfaceSamplerCount: isFiniteNumber(input.surfaceSamplerCount)
      ? clampSurfaceSamplerCount(input.surfaceSamplerCount)
      : base.surfaceSamplerCount,
    surfaceSamplerPointSize: isFiniteNumber(input.surfaceSamplerPointSize)
      ? clampSurfaceSamplerPointSize(input.surfaceSamplerPointSize)
      : base.surfaceSamplerPointSize,
    surfaceSamplerSphereSize: isFiniteNumber(input.surfaceSamplerSphereSize)
      ? clampSurfaceSamplerSphereSize(input.surfaceSamplerSphereSize)
      : base.surfaceSamplerSphereSize,
    surfaceSamplerShowMesh:
      typeof input.surfaceSamplerShowMesh === 'boolean'
        ? input.surfaceSamplerShowMesh
        : base.surfaceSamplerShowMesh,
    surfaceSamplerAnimate:
      typeof input.surfaceSamplerAnimate === 'boolean'
        ? input.surfaceSamplerAnimate
        : base.surfaceSamplerAnimate,
  };

  return storedVersion < 11 && isLegacyFullBleedBrandmark(normalized)
    ? migrateLegacyBrandmark(normalized)
    : normalized;
}

/**
 * A stored document always wins. Only when there is nothing to restore does the
 * UI theme get a say: arriving in a dark interface, a brand-new document starts
 * on the night canvas so the artwork is not a floodlight. This reads nothing and
 * writes nothing — the stored shape is unchanged.
 */
export function initialDocument(canvasTheme: CanvasThemeId = 'day'): Document {
  const stored = loadDocument();
  if (stored) return stored;
  const fresh = clonePreset(DEFAULT_PRESET);
  return { ...fresh, theme: { ...CANVAS_THEMES[canvasTheme] } };
}

export function serializeDocument(doc: Document): string {
  const stored: StoredDocument = {
    ...cloneDocument(doc),
    version: DOCUMENT_VERSION,
  };
  return JSON.stringify(stored, null, 2);
}

export function parseDocumentJson(json: string): Document {
  return normalizeDocument(JSON.parse(json));
}

export function downloadJson(doc: Document, name = 'metaball-document'): void {
  const blob = new Blob([serializeDocument(doc)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${name}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
