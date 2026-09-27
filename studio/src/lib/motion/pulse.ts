// Global radius breathing — no evaporate.
import { effectiveNodeRadius, nodeId } from '../model';
import {
  clamp,
  easeInOutSmooth,
  hash01,
  lerp,
  restStyle,
  type MotionDef,
  type MotionDoc,
  type MotionStyle,
} from './types';

export const PULSE_PERIOD_MS = 4200;

export function applyPulseDisplay(doc: MotionDoc, elapsedMs: number): MotionStyle {
  const base = restStyle(doc);
  const u = ((elapsedMs % PULSE_PERIOD_MS) + PULSE_PERIOD_MS) % PULSE_PERIOD_MS;
  const half = PULSE_PERIOD_MS / 2;
  const breath =
    u <= half ? easeInOutSmooth(u / half) : easeInOutSmooth(1 - (u - half) / half);
  // 0.7 ↔ 1.15
  const scale = lerp(0.7, 1.15, breath);

  const nodes = doc.nodes.map((node) => {
    const id = nodeId(node.r, node.c);
    const phase = hash01(`${id}|pulse`) * 0.12;
    const local = clamp(scale + (breath - 0.5) * phase, 0.55, 1.25);
    const r0 = effectiveNodeRadius(node);
    return { ...node, radius: r0 * local };
  });

  const neckBoost = lerp(0.92, 1.12, breath);
  return {
    ...base,
    nodes,
    tubeFactor: clamp(doc.tubeFactor * neckBoost, 0.05, 1.6),
    gooStd: clamp(doc.gooStd * lerp(0.95, 1.08, breath), 4, 48),
    evaporate: 0,
  };
}

export const pulseMotion: MotionDef = {
  id: 'pulse',
  label: 'Pulse',
  hint: 'Loop: global radius breathe',
  group: 'liquid',
  apply: applyPulseDisplay,
};
