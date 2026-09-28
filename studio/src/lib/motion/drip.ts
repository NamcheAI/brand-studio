// Outermost node scales down, falls, hits near floor, grows back and snaps.
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

export const DRIP_PERIOD_MS = 5500;
const FALL = 72;

function dripPhases(elapsedMs: number, periodMs = DRIP_PERIOD_MS) {
  const u = (((elapsedMs % periodMs) + periodMs) % periodMs) / periodMs;
  // detach/shrink 0–0.2, fall 0.2–0.55, splash grow 0.55–0.7, snap/rejoin 0.7–1
  if (u < 0.2) {
    const t = easeInOutSmooth(u / 0.2);
    return { fall: 0, shrink: t, splash: 0, rejoin: 0 };
  }
  if (u < 0.55) {
    const t = easeInOutSmooth((u - 0.2) / 0.35);
    return { fall: t, shrink: 1, splash: 0, rejoin: 0 };
  }
  if (u < 0.7) {
    const t = easeInOutSmooth((u - 0.55) / 0.15);
    return { fall: 1, shrink: 1 - t * 0.35, splash: t, rejoin: 0 };
  }
  const t = easeInOutSmooth((u - 0.7) / 0.3);
  return { fall: 1 - t, shrink: 0.65 * (1 - t), splash: 1 - t, rejoin: t };
}

export function applyDripDisplay(doc: MotionDoc, elapsedMs: number): MotionStyle {
  const base = restStyle(doc);
  if (doc.nodes.length === 0) return base;

  const { x: cx, y: cy } = markCentroid(doc.nodes);
  // Pick outermost node (max distance from centroid); stable hash tie-break.
  let dripId = '';
  let best = -1;
  for (const node of doc.nodes) {
    const id = nodeId(node.r, node.c);
    const pos = nodePosition(node);
    const d = Math.hypot(pos.cx - cx, pos.cy - cy) + hash01(id) * 0.01;
    if (d > best) {
      best = d;
      dripId = id;
    }
  }

  const { fall, shrink, splash, rejoin } = dripPhases(elapsedMs);

  const nodes = doc.nodes.map((node) => {
    const id = nodeId(node.r, node.c);
    const r0 = effectiveNodeRadius(node);
    if (id !== dripId) {
      // Soft reaction: slight upward settle when drip falls.
      return {
        ...node,
        offsetY: (node.offsetY ?? 0) - fall * 3 * (1 - rejoin),
        radius: r0 * (1 + splash * 0.06),
      };
    }
    const scale = clamp(1 - shrink * 0.55 + splash * 0.35, 0.25, 1.25);
    return {
      ...node,
      offsetY: (node.offsetY ?? 0) + FALL * fall * (1 - rejoin * 0.15),
      radius: r0 * scale,
    };
  });

  return {
    ...base,
    nodes,
    tubeFactor: clamp(doc.tubeFactor * (1 - shrink * 0.25 + rejoin * 0.1), 0.05, 1.6),
    evaporate: 0,
  };
}

export const dripMotion: MotionDef = {
  id: 'drip',
  label: 'Drip',
  hint: 'Loop: outer drop falls and rejoins',
  group: 'liquid',
  apply: applyDripDisplay,
};
