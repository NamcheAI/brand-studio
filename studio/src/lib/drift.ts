// Non-destructive drift playback: nodes ease apart from the mark centroid
// and reform, so goo necks can break and fuse again. Loops continuously.
import {
  nodeId,
  nodePosition,
  type Edge,
  type GridNode,
  type NodeId,
} from './model';

/** Full explode→reform cycle length. */
export const DRIFT_PERIOD_MS = 7200;

/** Peak radial travel in SVG units (before per-node phase modulation). */
export const DRIFT_PEAK_OFFSET = 68;

export type DriftDisplay = {
  nodes: GridNode[];
  edges: Edge[];
};

function hash01(id: NodeId): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function easeInOutSmooth(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/**
 * Global drift amount in [0, 1]: 0 = rest form, 1 = fully apart.
 * One period goes rest → apart → rest.
 */
export function driftAmountAtElapsed(elapsedMs: number, periodMs = DRIFT_PERIOD_MS): number {
  const u = ((elapsedMs % periodMs) + periodMs) % periodMs;
  const half = periodMs / 2;
  if (u <= half) return easeInOutSmooth(u / half);
  return easeInOutSmooth(1 - (u - half) / half);
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

/**
 * Apply radial offsets from the mark centroid. Authored offsetX/Y are preserved
 * as the rest pose; drift adds on top. Edges are unchanged.
 */
export function applyDriftDisplay(
  nodes: GridNode[],
  edges: Edge[],
  amount: number,
  peakOffset = DRIFT_PEAK_OFFSET,
): DriftDisplay {
  if (nodes.length === 0 || amount <= 0.0001) {
    return { nodes, edges };
  }

  const { x: cx, y: cy } = markCentroid(nodes);
  const displayNodes: GridNode[] = nodes.map((node) => {
    const id = nodeId(node.r, node.c);
    const pos = nodePosition(node);
    let dx = pos.cx - cx;
    let dy = pos.cy - cy;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) {
      // Coincident with centroid: pick a stable pseudo-random direction.
      const a = hash01(id) * Math.PI * 2;
      dx = Math.cos(a);
      dy = Math.sin(a);
    } else {
      dx /= len;
      dy /= len;
    }

    // Phase stagger so nodes don't explode in lockstep.
    const phase = hash01(`${id}|ph`);
    const local = Math.min(1, Math.max(0, amount * (0.72 + phase * 0.55)));
    const reach = peakOffset * (0.85 + hash01(`${id}|r`) * 0.35);
    // Display-only: do not clamp to edit limits so necks can fully break apart.
    const ox = (node.offsetX ?? 0) + dx * reach * local;
    const oy = (node.offsetY ?? 0) + dy * reach * local;

    return {
      ...node,
      offsetX: ox,
      offsetY: oy,
    };
  });

  return { nodes: displayNodes, edges };
}
