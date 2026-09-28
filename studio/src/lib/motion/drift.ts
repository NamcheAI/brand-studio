// Drift wrapper for the motion registry.
import { applyDriftDisplay, driftAmountAtElapsed, DRIFT_PERIOD_MS } from '../drift';
import { restStyle, type MotionDef, type MotionDoc, type MotionStyle } from './types';

export function applyDriftMotion(doc: MotionDoc, elapsedMs: number): MotionStyle {
  const amount = driftAmountAtElapsed(elapsedMs, DRIFT_PERIOD_MS);
  const { nodes, edges } = applyDriftDisplay(doc.nodes, doc.edges, amount);
  return {
    ...restStyle(doc),
    nodes,
    edges,
  };
}

export const driftMotion: MotionDef = {
  id: 'drift',
  label: 'Drift',
  hint: 'Loop: explode apart then reform',
  group: 'classic',
  apply: applyDriftMotion,
};
