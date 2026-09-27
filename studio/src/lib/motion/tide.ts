import { applyTideDisplay } from '../tide';
import type { MotionDef, MotionDoc, MotionStyle } from './types';

export function applyTideMotion(doc: MotionDoc, elapsedMs: number): MotionStyle {
  const tided = applyTideDisplay(doc, elapsedMs);
  return {
    nodes: tided.nodes,
    edges: tided.edges,
    tubeFactor: tided.tubeFactor,
    inwardPull: tided.inwardPull,
    gooStd: tided.gooStd,
    edgeFactors: tided.edgeFactors,
    edgePulls: tided.edgePulls,
    evaporate: tided.evaporate,
  };
}

export const tideMotion: MotionDef = {
  id: 'tide',
  label: 'Tide',
  hint: 'Loop: fill, merge, evaporate, reform',
  group: 'classic',
  apply: applyTideMotion,
};
