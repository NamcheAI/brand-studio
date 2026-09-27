// Non-destructive mycelium-style growth playback for the brandmark graph.
import {
  effectiveNodeRadius,
  nodeId,
  type Edge,
  type GridNode,
  type NodeId,
} from './model';

export const GROWTH_DURATION_MS = 2400;

export type GrowthSchedule = {
  depths: Map<NodeId, number>;
  maxDepth: number;
};

function adjacency(edges: Edge[]): Map<NodeId, NodeId[]> {
  const adj = new Map<NodeId, NodeId[]>();
  const link = (a: NodeId, b: NodeId) => {
    const list = adj.get(a);
    if (list) list.push(b);
    else adj.set(a, [b]);
  };
  for (const [a, b] of edges) {
    link(a, b);
    link(b, a);
  }
  return adj;
}

/** Pick the graph-most-central node (min eccentricity); fallback: earliest in array. */
export function pickGrowthRoot(nodes: GridNode[], edges: Edge[]): NodeId | null {
  if (nodes.length === 0) return null;
  const ids = nodes.map((n) => nodeId(n.r, n.c));
  const adj = adjacency(edges);

  const eccentricity = (root: NodeId): number => {
    const dist = new Map<NodeId, number>([[root, 0]]);
    const queue: NodeId[] = [root];
    let max = 0;
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const d = dist.get(cur)!;
      max = Math.max(max, d);
      for (const next of adj.get(cur) ?? []) {
        if (dist.has(next)) continue;
        dist.set(next, d + 1);
        queue.push(next);
      }
    }
    // Unreachable nodes: treat as far so connected hubs win.
    for (const id of ids) {
      if (!dist.has(id)) max = Math.max(max, ids.length);
    }
    return max;
  };

  let best = ids[0];
  let bestEcc = Infinity;
  let bestCenterDist = Infinity;
  for (const id of ids) {
    const ecc = eccentricity(id);
    const [r, c] = id.split('-').map(Number);
    const centerDist = (r - 2) ** 2 + (c - 2) ** 2;
    if (ecc < bestEcc || (ecc === bestEcc && centerDist < bestCenterDist)) {
      best = id;
      bestEcc = ecc;
      bestCenterDist = centerDist;
    }
  }
  return best;
}

/** BFS depths from the growth root (disconnected nodes get maxDepth+1, staggered late). */
export function buildGrowthSchedule(nodes: GridNode[], edges: Edge[]): GrowthSchedule {
  const depths = new Map<NodeId, number>();
  if (nodes.length === 0) return { depths, maxDepth: 0 };

  const root = pickGrowthRoot(nodes, edges)!;
  const adj = adjacency(edges);
  const queue: NodeId[] = [root];
  depths.set(root, 0);
  let maxDepth = 0;

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const d = depths.get(cur)!;
    for (const next of adj.get(cur) ?? []) {
      if (depths.has(next)) continue;
      const nd = d + 1;
      depths.set(next, nd);
      maxDepth = Math.max(maxDepth, nd);
      queue.push(next);
    }
  }

  // Isolated / unreachable: grow after the connected component.
  const orphanDepth = maxDepth + 1;
  for (const node of nodes) {
    const id = nodeId(node.r, node.c);
    if (!depths.has(id)) {
      depths.set(id, orphanDepth);
      maxDepth = Math.max(maxDepth, orphanDepth);
    }
  }

  return { depths, maxDepth };
}

function easeOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) ** 3;
}

/** Per-node display scale in [0, 1] at elapsed ms into the growth. */
export function scalesAtElapsed(
  schedule: GrowthSchedule,
  elapsedMs: number,
  durationMs = GROWTH_DURATION_MS,
): Map<NodeId, number> {
  const { depths, maxDepth } = schedule;
  const scales = new Map<NodeId, number>();
  const window = durationMs * 0.45;
  const span = Math.max(0, durationMs - window);

  for (const [id, depth] of depths) {
    const start = maxDepth === 0 ? 0 : (depth / maxDepth) * span;
    const local = (elapsedMs - start) / window;
    scales.set(id, easeOutCubic(local));
  }
  return scales;
}

export type GrowthDisplay = {
  nodes: GridNode[];
  edges: Edge[];
};

/** Apply display radii and filter edges until both endpoints have started growing. */
export function applyGrowthDisplay(
  nodes: GridNode[],
  edges: Edge[],
  scales: Map<NodeId, number>,
): GrowthDisplay {
  const displayNodes: GridNode[] = nodes.map((node) => {
    const id = nodeId(node.r, node.c);
    const scale = scales.get(id) ?? 0;
    const base = effectiveNodeRadius(node);
    return { ...node, radius: base * scale };
  });

  const displayEdges = edges.filter(([a, b]) => {
    const sa = scales.get(a) ?? 0;
    const sb = scales.get(b) ?? 0;
    return sa > 0 && sb > 0;
  });

  return { nodes: displayNodes, edges: displayEdges };
}
