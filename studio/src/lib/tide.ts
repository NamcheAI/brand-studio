// Non-destructive tide: fill from inside → merge → evaporate → reform.
import {
  GOO_STD_MAX,
  GOO_STD_MIN,
  TUBE_FACTOR_MAX,
  TUBE_FACTOR_MIN,
  edgeKey,
  effectiveNodeRadius,
  nodeId,
  nodePosition,
  type Document,
  type Edge,
  type GridNode,
} from './model';

/** Full fill → merge → evaporate → reform cycle. */
export const TIDE_PERIOD_MS = 13000;

export type TideDisplay = {
  nodes: GridNode[];
  edges: Edge[];
  tubeFactor: number;
  inwardPull: number;
  gooStd: number;
  edgeFactors: Record<string, number>;
  edgePulls: Record<string, number>;
  /** 0–1 evaporation progress used to modulate the 3D liquid material. */
  evaporate: number;
};

function hash01(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function easeInOutSmooth(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function markCentroid(nodes: GridNode[]): { x: number; y: number } {
  if (nodes.length === 0) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const node of nodes) {
    const { cx, cy } = nodePosition(node);
    sx += cx;
    sy += cy;
  }
  return { x: sx / nodes.length, y: sy / nodes.length };
}

function rotate2(x: number, y: number, angle: number): { x: number; y: number } {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: x * c - y * s, y: x * s + y * c };
}

/**
 * Phase weights over one tide cycle. The seam sits between a completed reform
 * and the next merge, so all values stay continuous when the animation wraps:
 * full beat → merge swirl → evaporate outside-in → empty beat → reform
 */
export function tidePhasesAtElapsed(elapsedMs: number, periodMs = TIDE_PERIOD_MS) {
  const u = ((elapsedMs % periodMs) + periodMs) % periodMs;
  const t = u / periodMs;
  let fill = 0;
  let merge = 0;
  let evaporate = 0;
  if (t < 0.08) {
    fill = 1;
  } else if (t < 0.28) {
    fill = 1;
    const mergeProgress = (t - 0.08) / 0.2;
    merge = easeInOutSmooth(1 - Math.abs(mergeProgress * 2 - 1));
  } else if (t < 0.58) {
    const evaporationProgress = easeInOutSmooth((t - 0.28) / 0.3);
    fill = 1 - evaporationProgress;
    evaporate = evaporationProgress;
  } else if (t < 0.64) {
    fill = 0;
  } else {
    fill = easeInOutSmooth((t - 0.64) / 0.36);
  }
  return { fill, merge, evaporate, t };
}

/**
 * Apply tide display: radii swell from centroid outward, necks fatten, then evaporate outside-in.
 */
export function applyTideDisplay(
  doc: Pick<
    Document,
    'nodes' | 'edges' | 'tubeFactor' | 'inwardPull' | 'gooStd' | 'edgeFactors' | 'edgePulls'
  >,
  elapsedMs: number,
  periodMs = TIDE_PERIOD_MS,
): TideDisplay {
  const { nodes, edges } = doc;
  const { fill, merge, evaporate } = tidePhasesAtElapsed(elapsedMs, periodMs);

  if (nodes.length === 0) {
    return {
      nodes,
      edges,
      tubeFactor: doc.tubeFactor,
      inwardPull: doc.inwardPull,
      gooStd: doc.gooStd,
      edgeFactors: { ...doc.edgeFactors },
      edgePulls: { ...doc.edgePulls },
      evaporate: 0,
    };
  }

  const { x: cx, y: cy } = markCentroid(nodes);
  let maxDist = 1;
  for (const node of nodes) {
    const p = nodePosition(node);
    maxDist = Math.max(maxDist, Math.hypot(p.cx - cx, p.cy - cy));
  }

  const swirl = merge * Math.PI * 1.25;
  const activity = Math.max(fill, merge, evaporate);

  const displayNodes: GridNode[] = nodes.map((node) => {
    const id = nodeId(node.r, node.c);
    const pos = nodePosition(node);
    const dist = Math.hypot(pos.cx - cx, pos.cy - cy);
    const norm = dist / maxDist;
    const phase = hash01(`${id}|tide`);
    // Inside-out fill: center first.
    const fillGate = easeInOutSmooth(clamp((fill - norm * 0.55 - phase * 0.08) / 0.45, 0, 1));
    // Outside-in evaporate: rim first.
    const evapGate = easeInOutSmooth(
      clamp((evaporate - (1 - norm) * 0.5 - phase * 0.1) / 0.5, 0, 1),
    );
    const scale = clamp(fillGate * (1 - evapGate * 0.98), 0, 1.15);
    const base = effectiveNodeRadius(node);
    // Slight swell during merge.
    const swell = 1 + merge * 0.12 * (0.6 + phase * 0.4);

    let offsetX = node.offsetX ?? 0;
    let offsetY = node.offsetY ?? 0;
    if (merge > 0.01) {
      const rx = pos.cx - cx;
      const ry = pos.cy - cy;
      const spun = rotate2(rx, ry, swirl * (0.35 + phase * 0.3));
      const cellX = pos.cx - offsetX;
      const cellY = pos.cy - offsetY;
      const breath = Math.sin(swirl * 2 + phase * 6) * merge * 6;
      offsetX = lerp(offsetX, spun.x + cx - cellX + breath * 0.3, merge * 0.55);
      offsetY = lerp(offsetY, spun.y + cy - cellY + breath * 0.3, merge * 0.55);
    }

    return {
      ...node,
      radius: Math.max(0.01, base * scale * swell),
      offsetX,
      offsetY,
    };
  });

  // Hide edges until both ends have some fill; keep during evaporate while scale > 0.
  const displayEdges = edges.filter(([a, b]) => {
    const na = displayNodes.find((n) => nodeId(n.r, n.c) === a);
    const nb = displayNodes.find((n) => nodeId(n.r, n.c) === b);
    if (!na || !nb) return false;
    return (na.radius ?? 0) > 0.5 && (nb.radius ?? 0) > 0.5;
  });

  const tubeFactor = clamp(
    lerp(doc.tubeFactor, Math.min(TUBE_FACTOR_MAX, doc.tubeFactor + 0.4), Math.max(fill, merge)),
    TUBE_FACTOR_MIN,
    TUBE_FACTOR_MAX,
  );
  const gooStd = clamp(
    lerp(doc.gooStd, Math.min(GOO_STD_MAX, doc.gooStd + 5), activity),
    GOO_STD_MIN,
    GOO_STD_MAX,
  );
  const inwardPull = lerp(doc.inwardPull, doc.inwardPull * 0.2, merge);

  const edgeFactors: Record<string, number> = { ...doc.edgeFactors };
  const edgePulls: Record<string, number> = { ...doc.edgePulls };
  for (const [a, b] of displayEdges) {
    const key = edgeKey(a, b);
    const baseFactor = doc.edgeFactors[key] ?? doc.tubeFactor;
    const basePull = doc.edgePulls[key] ?? doc.inwardPull;
    const ph = hash01(`${key}|tide-neck`);
    edgeFactors[key] = clamp(
      lerp(baseFactor, 0.95, (fill * 0.5 + merge) * (0.6 + ph * 0.4)),
      TUBE_FACTOR_MIN,
      TUBE_FACTOR_MAX,
    );
    edgePulls[key] = lerp(basePull, 0.04, merge);
  }

  return {
    nodes: displayNodes,
    edges: displayEdges,
    tubeFactor,
    inwardPull,
    gooStd,
    edgeFactors,
    edgePulls,
    evaporate,
  };
}
