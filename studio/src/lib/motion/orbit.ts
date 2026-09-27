// Nodes circle the centroid with soft necks.
import { nodeId, nodePosition } from '../model';
import {
  clamp,
  hash01,
  markCentroid,
  restStyle,
  type MotionDef,
  type MotionDoc,
  type MotionStyle,
} from './types';

export const ORBIT_PERIOD_MS = 9000;

export function applyOrbitDisplay(doc: MotionDoc, elapsedMs: number): MotionStyle {
  const base = restStyle(doc);
  if (doc.nodes.length === 0) return base;

  const { x: cx, y: cy } = markCentroid(doc.nodes);
  const t = (elapsedMs / ORBIT_PERIOD_MS) * Math.PI * 2;

  const nodes = doc.nodes.map((node) => {
    const id = nodeId(node.r, node.c);
    const pos = nodePosition(node);
    const dx = pos.cx - cx;
    const dy = pos.cy - cy;
    const phase = hash01(`${id}|orb`) * Math.PI * 2;
    const speed = 0.85 + hash01(`${id}|spd`) * 0.35;
    const ang = t * speed + phase;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const rx = dx * c - dy * s;
    const ry = dx * s + dy * c;
    // Keep authored offset as rest; replace world offset so orbit is absolute around centroid.
    return {
      ...node,
      offsetX: (node.offsetX ?? 0) + (rx - dx),
      offsetY: (node.offsetY ?? 0) + (ry - dy),
    };
  });

  const soft = 1.22;
  return {
    ...base,
    nodes,
    tubeFactor: clamp(doc.tubeFactor * soft, 0.05, 1.8),
    inwardPull: clamp(doc.inwardPull * 0.75, 0, 1),
    gooStd: clamp(doc.gooStd * 1.15, 4, 48),
    edgeFactors: Object.fromEntries(
      Object.entries(doc.edgeFactors).map(([k, v]) => [k, clamp(v * soft, 0.05, 2)]),
    ),
    evaporate: 0,
  };
}

export const orbitMotion: MotionDef = {
  id: 'orbit',
  label: 'Orbit',
  hint: 'Loop: nodes circle centroid',
  group: 'liquid',
  apply: applyOrbitDisplay,
};
