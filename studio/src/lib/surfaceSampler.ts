// Bake the live MarchingCubes isosurface into a compact mesh, then sample
// random surface points via MeshSurfaceSampler (Codrops-style).
import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';
import type { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';

export type SurfaceSample = {
  positions: Float32Array;
  normals: Float32Array;
  count: number;
};

/**
 * Clone the active MarchingCubes draw range into a compact Mesh.
 * The MC buffer is preallocated — never sample the raw geometry directly.
 */
export function bakeCompactMesh(source: MarchingCubes): THREE.Mesh | null {
  if (!source || source.count === 0) return null;

  const srcGeo = source.geometry;
  const count = source.count;
  const posAttr = srcGeo.getAttribute('position') as THREE.BufferAttribute;
  const nrmAttr = srcGeo.getAttribute('normal') as THREE.BufferAttribute;

  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) {
    positions[i] = posAttr.array[i] as number;
    normals[i] = nrmAttr.array[i] as number;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));

  const scale = source.scale.x;
  geo.scale(scale, scale, scale);

  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
}

/** Sample `count` random points (+ normals) on the mesh surface. */
export function sampleSurface(
  mesh: THREE.Mesh,
  count: number,
  /** Push samples outward so they sit above the opaque isosurface. */
  normalOffset = 0.022,
): SurfaceSample {
  const sampler = new MeshSurfaceSampler(mesh).build();
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const tempPosition = new THREE.Vector3();
  const tempNormal = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    sampler.sample(tempPosition, tempNormal);
    if (tempNormal.lengthSq() > 0) tempNormal.normalize();
    tempPosition.addScaledVector(tempNormal, normalOffset);
    const o = i * 3;
    positions[o] = tempPosition.x;
    positions[o + 1] = tempPosition.y;
    positions[o + 2] = tempPosition.z;
    normals[o] = tempNormal.x;
    normals[o + 1] = tempNormal.y;
    normals[o + 2] = tempNormal.z;
  }

  return { positions, normals, count };
}

/**
 * Bake the live isosurface and sample it. Disposes the temporary mesh.
 * Returns null when the mesh is empty.
 */
export function sampleMarchingCubesSurface(
  source: MarchingCubes,
  count: number,
): SurfaceSample | null {
  const mesh = bakeCompactMesh(source);
  if (!mesh) return null;
  try {
    return sampleSurface(mesh, count);
  } finally {
    mesh.geometry.dispose();
    const mat = mesh.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat.dispose();
  }
}
