// Controlled L/R split, hold, merge (gentler than Drift).
import { nodeId, nodePosition } from '../model';
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

export const SPLIT_PERIOD_MS = 9000;
const PEAK = 48;

/** Envelope: split (0–0.35) → hold (0.35–0.55) → merge (0.55–1). */
function splitEnvelope(elapsedMs: number, periodMs = SPLIT_PERIOD_MS): number {
  const u = (((elapsedMs % periodMs) + periodMs) % periodMs) / periodMs;
  if (u < 0.35) return easeInOutSmooth(u / 0.35);
  if (u < 0.55) return 1;
  return easeInOutSmooth(1 - (u - 0.55) / 0.45);
}

export function applySplitDisplay(doc: MotionDoc, elapsedMs: number): MotionStyle {
  const base = restStyle(doc);
  if (doc.nodes.length === 0) return base;

  const amount = splitEnvelope(elapsedMs);
  const { x: cx, y: cy } = markCentroid(doc.nodes);

  const nodes = doc.nodes.map((node) => {
    const id = nodeId(node.r, node.c);
    const pos = nodePosition(node);
    const side = pos.cx >= cx ? 1 : -1;
    const vy = (pos.cy - cy) * 0.12 * amount;
    const jitter = (hash01(`${id}|sj`) - 0.5) * 6 * amount;
    return {
      ...node,
      offsetX: (node.offsetX ?? 0) + side * PEAK * amount + jitter,
      offsetY: (node.offsetY ?? 0) + vy,
    };
  });

  const neck = 1 - amount * 0.35;
  return {
    ...base,
    nodes,
    tubeFactor: clamp(doc.tubeFactor * neck, 0.05, 1.6),
    gooStd: clamp(doc.gooStd * (1 - amount * 0.2), 4, 48),
    evaporate: 0,
  };
}

export const splitMotion: MotionDef = {
  id: 'split',
  label: 'Split',
  hint: 'Loop: controlled left/right split then merge',
  group: 'liquid',
  apply: applySplitDisplay,
};
