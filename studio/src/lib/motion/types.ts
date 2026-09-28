// Shared types for looping liquid/form motion playbacks.
import { nodePosition, type Document, type Edge, type GridNode } from '../model';

export type MotionDoc = Pick<
  Document,
  | 'nodes'
  | 'edges'
  | 'tubeFactor'
  | 'inwardPull'
  | 'gooStd'
  | 'edgeFactors'
  | 'edgePulls'
>;

export type MotionStyle = {
  nodes: GridNode[];
  edges: Edge[];
  tubeFactor: number;
  inwardPull: number;
  gooStd: number;
  edgeFactors: Record<string, number>;
  edgePulls: Record<string, number>;
  evaporate?: number;
};

export type LoopMotionId =
  | 'drift'
  | 'flow'
  | 'tide'
  | 'drip'
  | 'splash'
  | 'pulse'
  | 'orbit'
  | 'boil'
  | 'pour'
  | 'split';

export type MotionDef = {
  id: LoopMotionId;
  label: string;
  hint: string;
  group: 'classic' | 'liquid';
  apply: (doc: MotionDoc, elapsedMs: number) => MotionStyle;
};

export function restStyle(doc: MotionDoc): MotionStyle {
  return {
    nodes: doc.nodes,
    edges: doc.edges,
    tubeFactor: doc.tubeFactor,
    inwardPull: doc.inwardPull,
    gooStd: doc.gooStd,
    edgeFactors: { ...doc.edgeFactors },
    edgePulls: { ...doc.edgePulls },
    evaporate: 0,
  };
}

export function hash01(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function easeInOutSmooth(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function markCentroid(nodes: GridNode[]): { x: number; y: number } {
  if (nodes.length === 0) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const node of nodes) {
    const p = nodePosition(node);
    sx += p.cx;
    sy += p.cy;
  }
  return { x: sx / nodes.length, y: sy / nodes.length };
}
