import type { LoopMotionId, MotionDef, MotionDoc, MotionStyle } from './types';
import { driftMotion } from './drift';
import { flowMotion } from './flow';
import { tideMotion } from './tide';
import { dripMotion } from './drip';
import { splashMotion } from './splash';
import { pulseMotion } from './pulse';
import { orbitMotion } from './orbit';
import { boilMotion } from './boil';
import { pourMotion } from './pour';
import { splitMotion } from './split';

const MOTIONS: MotionDef[] = [
  driftMotion,
  flowMotion,
  tideMotion,
  dripMotion,
  splashMotion,
  pulseMotion,
  orbitMotion,
  boilMotion,
  pourMotion,
  splitMotion,
];

const BY_ID = Object.fromEntries(MOTIONS.map((m) => [m.id, m])) as Record<
  LoopMotionId,
  MotionDef
>;

export function getMotion(id: LoopMotionId): MotionDef {
  return BY_ID[id];
}

export function applyMotion(id: LoopMotionId, doc: MotionDoc, elapsedMs: number): MotionStyle {
  return BY_ID[id].apply(doc, elapsedMs);
}

export function classicMotions(): MotionDef[] {
  return MOTIONS.filter((m) => m.group === 'classic');
}

export function liquidMotions(): MotionDef[] {
  return MOTIONS.filter((m) => m.group === 'liquid');
}

export function allLoopMotions(): MotionDef[] {
  return MOTIONS;
}

export type { LoopMotionId, MotionDef, MotionDoc, MotionStyle };
export { MOTIONS };
