// Chaotic multi-freq jitter + radius bubbles (playback simmer).
import { effectiveNodeRadius, nodeId, nodePosition } from '../model';
import {
  clamp,
  hash01,
  restStyle,
  type MotionDef,
  type MotionDoc,
  type MotionStyle,
} from './types';

export const BOIL_PERIOD_MS = 6000;

export function applyBoilDisplay(doc: MotionDoc, elapsedMs: number): MotionStyle {
  const base = restStyle(doc);
  if (doc.nodes.length === 0) return base;

  const t = elapsedMs * 0.001;

  const nodes = doc.nodes.map((node) => {
    const id = nodeId(node.r, node.c);
    const a = hash01(`${id}|b1`) * Math.PI * 2;
    const b = hash01(`${id}|b2`) * Math.PI * 2;
    const c = hash01(`${id}|b3`) * Math.PI * 2;
    const amp = 10 + hash01(`${id}|amp`) * 16;
    const ox =
      Math.sin(t * 3.1 + a) * amp +
      Math.sin(t * 7.4 + b) * amp * 0.45 +
      Math.sin(t * 11.2 + c) * amp * 0.22;
    const oy =
      Math.cos(t * 2.7 + a) * amp +
      Math.cos(t * 6.8 + b) * amp * 0.4 +
      Math.cos(t * 13.1 + c) * amp * 0.2;
    const bubble = 0.82 + 0.38 * (0.5 + 0.5 * Math.sin(t * 5.5 + c));
    const r0 = effectiveNodeRadius(node);
    // Keep position stable for reading — offsets are display-only.
    void nodePosition;
    return {
      ...node,
      offsetX: (node.offsetX ?? 0) + ox,
      offsetY: (node.offsetY ?? 0) + oy,
      radius: r0 * bubble,
    };
  });

  return {
    ...base,
    nodes,
    tubeFactor: clamp(doc.tubeFactor * 1.08, 0.05, 1.7),
    gooStd: clamp(doc.gooStd * 1.2, 4, 48),
    evaporate: 0,
  };
}

export const boilMotion: MotionDef = {
  id: 'boil',
  label: 'Boil',
  hint: 'Loop: chaotic bubbles + jitter',
  group: 'liquid',
  apply: applyBoilDisplay,
};
