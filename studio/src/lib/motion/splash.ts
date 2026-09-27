// Short radial shockwave from centroid (~2.5s loop).
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

export const SPLASH_PERIOD_MS = 2500;
const PEAK = 52;

export function applySplashDisplay(doc: MotionDoc, elapsedMs: number): MotionStyle {
  const base = restStyle(doc);
  if (doc.nodes.length === 0) return base;

  const u = ((elapsedMs % SPLASH_PERIOD_MS) + SPLASH_PERIOD_MS) % SPLASH_PERIOD_MS;
  const half = SPLASH_PERIOD_MS / 2;
  // Out then in.
  const amount =
    u <= half ? easeInOutSmooth(u / half) : easeInOutSmooth(1 - (u - half) / half);

  const { x: cx, y: cy } = markCentroid(doc.nodes);

  const nodes = doc.nodes.map((node) => {
    const id = nodeId(node.r, node.c);
    const pos = nodePosition(node);
    let dx = pos.cx - cx;
    let dy = pos.cy - cy;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) {
      const a = hash01(id) * Math.PI * 2;
      dx = Math.cos(a);
      dy = Math.sin(a);
    } else {
      dx /= len;
      dy /= len;
    }
    const phase = hash01(`${id}|sp`);
    const local = clamp(amount * (0.75 + phase * 0.5), 0, 1);
    const reach = PEAK * (0.8 + hash01(`${id}|r`) * 0.4);
    const r0 = effectiveNodeRadius(node);
    const rBoost = 1 + local * 0.28;
    return {
      ...node,
      offsetX: (node.offsetX ?? 0) + dx * reach * local,
      offsetY: (node.offsetY ?? 0) + dy * reach * local,
      radius: r0 * rBoost,
    };
  });

  return {
    ...base,
    nodes,
    tubeFactor: clamp(doc.tubeFactor * (1 + amount * 0.2), 0.05, 1.7),
    evaporate: 0,
  };
}

export const splashMotion: MotionDef = {
  id: 'splash',
  label: 'Splash',
  hint: 'Loop: radial shockwave',
  group: 'liquid',
  apply: applySplashDisplay,
};
