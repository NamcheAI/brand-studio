// Mass drifts +X then back; density follows the flow side.
import { effectiveNodeRadius, nodeId, nodePosition } from '../model';
import {
  clamp,
  easeInOutSmooth,
  hash01,
  markCentroid,
  restStyle,
  type MotionDef,
  type MotionDoc,
  type MotionStyle,
} from './types';

export const POUR_PERIOD_MS = 8000;
const PEAK_X = 58;

export function applyPourDisplay(doc: MotionDoc, elapsedMs: number): MotionStyle {
  const base = restStyle(doc);
  if (doc.nodes.length === 0) return base;

  const u = ((elapsedMs % POUR_PERIOD_MS) + POUR_PERIOD_MS) % POUR_PERIOD_MS;
  const half = POUR_PERIOD_MS / 2;
  const amount =
    u <= half ? easeInOutSmooth(u / half) : easeInOutSmooth(1 - (u - half) / half);

  const { x: cx } = markCentroid(doc.nodes);

  const nodes = doc.nodes.map((node) => {
    const id = nodeId(node.r, node.c);
    const pos = nodePosition(node);
    const side = pos.cx - cx;
    // Leading edge (right of centroid when pouring +X) densifies slightly.
    const lead = clamp(0.5 + side / 80, 0.25, 1);
    const lag = 0.7 + hash01(`${id}|lag`) * 0.45;
    const ox = PEAK_X * amount * lag;
    const oy = Math.sin(amount * Math.PI) * (4 + hash01(`${id}|y`) * 6) * (side > 0 ? 0.4 : 1);
    const r0 = effectiveNodeRadius(node);
    const dens = 1 + amount * 0.22 * lead - amount * 0.12 * (1 - lead);
    return {
      ...node,
      offsetX: (node.offsetX ?? 0) + ox,
      offsetY: (node.offsetY ?? 0) + oy,
      radius: r0 * dens,
    };
  });

  return {
    ...base,
    nodes,
    tubeFactor: clamp(doc.tubeFactor * (1 + amount * 0.15), 0.05, 1.7),
    inwardPull: clamp(doc.inwardPull * (1 - amount * 0.2), 0, 1),
    evaporate: 0,
  };
}

export const pourMotion: MotionDef = {
  id: 'pour',
  label: 'Pour',
  hint: 'Loop: mass flows right then back',
  group: 'liquid',
  apply: applyPourDisplay,
};
