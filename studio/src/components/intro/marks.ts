import { generate, type GenerateParams } from '@namche/metaball';

import { DEFAULT_PRESET, type Edge, type GridNode, type Size } from '../../lib/model';

/* The five states the intro walks through, all derived from one preset: the
   Namche Loop. Nothing here is hand-drawn — the page varies radii, edges and
   render mode, and lets @namche/metaball produce the geometry. */

export const LOOP_NODES: GridNode[] = DEFAULT_PRESET.nodes;
export const LOOP_EDGES: Edge[] = DEFAULT_PRESET.edges;

/** Step 1 — every node the same, deliberately small: a raster of possibilities. */
export const SEED_NODES: GridNode[] = LOOP_NODES.map((node) => ({ ...node, size: 'S' }));

/** Step 2 — the same five cells, now weighted. */
const WEIGHTS: Size[] = ['L', 'XL', 'M', 'XL', 'L'];
export const WEIGHTED_NODES: GridNode[] = LOOP_NODES.map((node, index) => ({
  ...node,
  size: WEIGHTS[index] ?? node.size,
}));

export type GooParams = {
  tubeFactor: number;
  gooStd: number;
  gooThreshold: number;
  inwardPull: number;
};

export const LOOP_GOO: GooParams = {
  tubeFactor: DEFAULT_PRESET.tubeFactor ?? 0.55,
  gooStd: DEFAULT_PRESET.gooStd ?? 9,
  gooThreshold: DEFAULT_PRESET.gooThreshold ?? 22,
  inwardPull: 0,
};

/** Traced paths are deterministic; a module cache keeps re-renders free. */
const pathCache = new Map<string, string>();
export function markPath(params: GenerateParams): string {
  const key = JSON.stringify(params);
  const cached = pathCache.get(key);
  if (cached !== undefined) return cached;
  const { d } = generate(params);
  pathCache.set(key, d);
  return d;
}
