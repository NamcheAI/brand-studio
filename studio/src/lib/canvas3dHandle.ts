import type { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';

/** Shared handle for 3D canvas snapshot, invalidate, and live mesh (Blender handoff / GLB). */
export type Canvas3DHandle = {
  canvas: HTMLCanvasElement | null;
  invalidate: () => void;
  mesh: MarchingCubes | null;
};

/** Module bridge — R3F and App can disagree on React refs; this stays authoritative. */
let liveMesh: MarchingCubes | null = null;

export function setLiveMarchingCubes(mesh: MarchingCubes | null): void {
  liveMesh = mesh;
}

export function getLiveMarchingCubes(): MarchingCubes | null {
  return liveMesh;
}
