import { applyFlowDisplay } from '../flow';
import type { MotionDef, MotionDoc, MotionStyle } from './types';

export function applyFlowMotion(doc: MotionDoc, elapsedMs: number): MotionStyle {
  const flowed = applyFlowDisplay(doc, elapsedMs);
  return {
    nodes: flowed.nodes,
    edges: flowed.edges,
    tubeFactor: flowed.tubeFactor,
    inwardPull: flowed.inwardPull,
    gooStd: flowed.gooStd,
    edgeFactors: flowed.edgeFactors,
    edgePulls: flowed.edgePulls,
    evaporate: 0,
  };
}

export const flowMotion: MotionDef = {
  id: 'flow',
  label: 'Flow',
  hint: 'Loop: melt, swirl, rebuild (soft necks)',
  group: 'classic',
  apply: applyFlowMotion,
};
