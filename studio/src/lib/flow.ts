// Non-destructive free-edge flow: the mark melts into a soft blob, swirls with
// continuous goo merges, then rebuilds. Keeps necks mostly fused (unlike Drift).
import {
  GOO_STD_MAX,
  GOO_STD_MIN,
  INWARD_PULL_MAX,
  INWARD_PULL_MIN,
  TUBE_FACTOR_MAX,
  TUBE_FACTOR_MIN,
  edgeKey,
  nodeId,
  nodePosition,
  type Document,
  type Edge,
  type GridNode,
} from './model';

/** Full melt → swirl → rebuild cycle. */
export const FLOW_PERIOD_MS = 11000;

/** Peak travel while still mostly fused (SVG units). */
export const FLOW_PEAK_OFFSET = 36;

export type FlowDisplay = {
  nodes: GridNode[];
  edges: Edge[];
  tubeFactor: number;
  inwardPull: number;
  gooStd: number;
  edgeFactors: Record<string, number>;
  edgePulls: Record<string, number>;
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

/**
 * Envelope in [0, 1]: how far from the authored rest form.
 * 0–0.12 rest hold → melt in → hold swirl → rebuild → rest.
 */
export function flowEnvelopeAtElapsed(elapsedMs: number, periodMs = FLOW_PERIOD_MS): number {
  const u = ((elapsedMs % periodMs) + periodMs) % periodMs;
  const t = u / periodMs;
  if (t < 0.08) return 0;
  if (t < 0.32) return easeInOutSmooth((t - 0.08) / 0.24);
  if (t < 0.68) return 1;
  if (t < 0.92) return easeInOutSmooth(1 - (t - 0.68) / 0.24);
  return 0;
}

/** Swirl angle progress (radians) during the flowing middle of the cycle. */
export function flowSwirlAtElapsed(elapsedMs: number, periodMs = FLOW_PERIOD_MS): number {
  const u = ((elapsedMs % periodMs) + periodMs) % periodMs;
  const t = u / periodMs;
  // Spin mostly while envelope is high.
  const spinWindow = clamp((t - 0.2) / 0.55, 0, 1);
  return easeInOutSmooth(spinWindow) * Math.PI * 2.15;
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
 * Apply fluid free-edge display: soft radial melt + orbital swirl + pulsing necks.
 * Style fields are display overrides; document remains untouched.
 */
export function applyFlowDisplay(
  doc: Pick<
    Document,
    | 'nodes'
    | 'edges'
    | 'tubeFactor'
    | 'inwardPull'
    | 'gooStd'
    | 'edgeFactors'
    | 'edgePulls'
  >,
  elapsedMs: number,
  periodMs = FLOW_PERIOD_MS,
  peakOffset = FLOW_PEAK_OFFSET,
): FlowDisplay {
  const { nodes, edges } = doc;
  const envelope = flowEnvelopeAtElapsed(elapsedMs, periodMs);
  const swirl = flowSwirlAtElapsed(elapsedMs, periodMs);

  if (nodes.length === 0 || envelope <= 0.0001) {
    return {
      nodes,
      edges,
      tubeFactor: doc.tubeFactor,
      inwardPull: doc.inwardPull,
      gooStd: doc.gooStd,
      edgeFactors: { ...doc.edgeFactors },
      edgePulls: { ...doc.edgePulls },
    };
  }

  const { x: cx, y: cy } = markCentroid(nodes);

  // Melt toward a denser cluster, then orbit — never a hard explode.
  const cluster = envelope * 0.42;
  const orbitAmp = peakOffset * (0.35 + envelope * 0.65);

  const displayNodes: GridNode[] = nodes.map((node) => {
    const id = nodeId(node.r, node.c);
    const pos = nodePosition(node);
    const rx = pos.cx - cx;
    const ry = pos.cy - cy;
    const phase = hash01(`${id}|flow`);
    const localSwirl = swirl + (phase - 0.5) * 0.9;
    const breath =
      Math.sin(swirl * 1.7 + phase * Math.PI * 2) * 0.5 +
      Math.sin(swirl * 0.55 + phase * 4.1) * 0.5;

    // Pull toward centroid (melt), then swirl the residual vector.
    const meltedX = rx * (1 - cluster);
    const meltedY = ry * (1 - cluster);
    const spun = rotate2(meltedX, meltedY, localSwirl * 0.55);

    // Tangential free-edge drift so necks stretch/slide instead of snap.
    const len = Math.hypot(spun.x, spun.y) || 1;
    const tx = -spun.y / len;
    const ty = spun.x / len;
    const tangential = orbitAmp * 0.55 * breath * envelope;
    const radialPulse = orbitAmp * 0.22 * breath * envelope;

    const targetX = cx + spun.x + tx * tangential + (spun.x / len) * radialPulse;
    const targetY = cy + spun.y + ty * tangential + (spun.y / len) * radialPulse;

    // Convert world target back into offset space relative to cell center.
    // nodePosition = cellCenter + offset, so offset' = target - cellCenter.
    const cellX = pos.cx - (node.offsetX ?? 0);
    const cellY = pos.cy - (node.offsetY ?? 0);

    return {
      ...node,
      offsetX: lerp(node.offsetX ?? 0, targetX - cellX, envelope),
      offsetY: lerp(node.offsetY ?? 0, targetY - cellY, envelope),
    };
  });

  // Fatter, softer merges while flowing; free per-edge neck modulation.
  const tubeFactor = clamp(
    lerp(doc.tubeFactor, Math.min(TUBE_FACTOR_MAX, doc.tubeFactor + 0.35), envelope),
    TUBE_FACTOR_MIN,
    TUBE_FACTOR_MAX,
  );
  const inwardPull = clamp(
    lerp(doc.inwardPull, Math.max(INWARD_PULL_MIN, doc.inwardPull * 0.25), envelope),
    INWARD_PULL_MIN,
    INWARD_PULL_MAX,
  );
  const gooStd = clamp(
    lerp(doc.gooStd, Math.min(GOO_STD_MAX, doc.gooStd + 4.5), envelope),
    GOO_STD_MIN,
    GOO_STD_MAX,
  );

  const edgeFactors: Record<string, number> = { ...doc.edgeFactors };
  const edgePulls: Record<string, number> = { ...doc.edgePulls };

  for (const [a, b] of edges) {
    const key = edgeKey(a, b);
    const baseFactor = doc.edgeFactors[key] ?? doc.tubeFactor;
    const basePull = doc.edgePulls[key] ?? doc.inwardPull;
    const ph = hash01(`${key}|neck`);
    const pulse = 0.5 + 0.5 * Math.sin(swirl * 2.2 + ph * Math.PI * 2);
    // Free necks: swell and ease so blobs pour into each other.
    const flowedFactor = clamp(
      lerp(baseFactor, 0.92, envelope * (0.55 + pulse * 0.45)),
      TUBE_FACTOR_MIN,
      TUBE_FACTOR_MAX,
    );
    const flowedPull = clamp(
      lerp(basePull, 0.05 + (1 - pulse) * 0.25, envelope),
      INWARD_PULL_MIN,
      INWARD_PULL_MAX,
    );
    edgeFactors[key] = flowedFactor;
    edgePulls[key] = flowedPull;
  }

  return {
    nodes: displayNodes,
    edges,
    tubeFactor,
    inwardPull,
    gooStd,
    edgeFactors,
    edgePulls,
  };
}
