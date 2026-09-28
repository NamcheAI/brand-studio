// Wander mode: nodes roam organically (apart / together / sideways).
// Necks break via distance in the goo field — no spoke amplify, no tube thinning.
import { nodeId, nodePosition, type GridNode } from '../model';
import {
  clamp,
  hash01,
  markCentroid,
  type MotionDoc,
  type MotionStyle,
} from './types';

/** Wander space in SVG units. */
export const WANDER_AMP = 26;

function nodeMap(nodes: GridNode[]): Map<string, GridNode> {
  return new Map(nodes.map((n) => [nodeId(n.r, n.c), n]));
}

type Vec = { x: number; y: number };

/**
 * Soft pairwise forces on top of multi-frequency wander:
 * mild repulsion when too close, mild attraction when far — so clusters
 * form and dissolve without radial “spoke” geometry.
 */
function pairForces(
  ids: string[],
  positions: Map<string, Vec>,
  restDist: Map<string, number>,
): Map<string, Vec> {
  const out = new Map<string, Vec>();
  for (const id of ids) out.set(id, { x: 0, y: 0 });

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i]!;
      const b = ids[j]!;
      const pa = positions.get(a)!;
      const pb = positions.get(b)!;
      let dx = pb.x - pa.x;
      let dy = pb.y - pa.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      dx /= dist;
      dy /= dist;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      const prefer = restDist.get(key) ?? 48;
      // Spring around preferred spacing, soft clamp.
      const err = dist - prefer;
      const k = err > 0 ? 0.12 : 0.18; // slightly stronger when overlapping
      const f = clamp(err * k, -14, 18);
      const fa = out.get(a)!;
      const fb = out.get(b)!;
      fa.x += dx * f;
      fa.y += dy * f;
      fb.x -= dx * f;
      fb.y -= dy * f;
    }
  }
  return out;
}

/**
 * Additive organic wander on a motion display.
 * Connections stay authored (tubeFactor/edges unchanged) so goo necks
 * curve and snap from spacing alone — not thin straight rods.
 */
export function applyBreakableNecks(
  rest: MotionDoc,
  style: MotionStyle,
  elapsedMs: number,
): MotionStyle {
  if (style.nodes.length === 0) return style;

  const t = elapsedMs * 0.001;
  const restNodes = nodeMap(rest.nodes);
  const { x: cx, y: cy } = markCentroid(rest.nodes);

  // Preferred pair spacing from rest pose (all pairs, not only edges).
  const ids = rest.nodes.map((n) => nodeId(n.r, n.c));
  const restPos = new Map<string, Vec>();
  for (const node of rest.nodes) {
    const id = nodeId(node.r, node.c);
    const p = nodePosition(node);
    restPos.set(id, { x: p.cx, y: p.cy });
  }
  const restDist = new Map<string, number>();
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i]!;
      const b = ids[j]!;
      const pa = restPos.get(a)!;
      const pb = restPos.get(b)!;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      restDist.set(key, Math.hypot(pb.x - pa.x, pb.y - pa.y) || 40);
    }
  }

  // Preliminary wander targets (before pair forces).
  const prelim = new Map<string, Vec>();
  for (const node of style.nodes) {
    const id = nodeId(node.r, node.c);
    const authored = restNodes.get(id) ?? node;
    const disp = nodePosition(node);
    const base = nodePosition(authored);
    const ph = hash01(`${id}|w1`);
    const ph2 = hash01(`${id}|w2`);
    const ph3 = hash01(`${id}|w3`);
    const amp = WANDER_AMP * (0.75 + hash01(`${id}|wa`) * 0.55);

    // Independent multi-freq wander (not radial spokes).
    const wx =
      Math.sin(t * 0.85 + ph * Math.PI * 2) * amp +
      Math.sin(t * 1.7 + ph2 * 5.1) * amp * 0.45 +
      Math.cos(t * 0.4 + ph3 * 3.2) * amp * 0.35;
    const wy =
      Math.cos(t * 0.75 + ph * 4.2) * amp +
      Math.sin(t * 1.55 + ph2 * Math.PI * 2) * amp * 0.4 +
      Math.sin(t * 0.5 + ph3 * 2.7) * amp * 0.38;

    // Slow breathe: sometimes lean out from / into the mark centroid.
    const breathe = Math.sin(t * 0.55 + ph * 2.4);
    let rdx = base.cx - cx;
    let rdy = base.cy - cy;
    const rlen = Math.hypot(rdx, rdy);
    if (rlen > 0.5) {
      rdx /= rlen;
      rdy /= rlen;
    } else {
      rdx = Math.cos(ph * Math.PI * 2);
      rdy = Math.sin(ph * Math.PI * 2);
    }
    const radial = breathe * amp * 0.55;

    prelim.set(id, {
      x: disp.cx + wx + rdx * radial,
      y: disp.cy + wy + rdy * radial,
    });
  }

  const forces = pairForces(ids, prelim, restDist);

  const nodes: GridNode[] = style.nodes.map((node) => {
    const id = nodeId(node.r, node.c);
    const authored = restNodes.get(id) ?? node;
    const base = nodePosition(authored);
    const cellX = base.cx - (authored.offsetX ?? 0);
    const cellY = base.cy - (authored.offsetY ?? 0);
    const p = prelim.get(id)!;
    const f = forces.get(id) ?? { x: 0, y: 0 };
    // Blend pair forces gently so wander stays organic.
    const wx = p.x + f.x * 0.55;
    const wy = p.y + f.y * 0.55;
    return {
      ...node,
      offsetX: wx - cellX,
      offsetY: wy - cellY,
    };
  });

  // Keep necks soft/curvy — distance alone tears the iso-surface.
  // Slightly softer goo helps merges look liquid when they come back together.
  return {
    ...style,
    nodes,
    gooStd: clamp(style.gooStd * 1.06, 4, 48),
  };
}
