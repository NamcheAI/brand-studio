// Export the live MarchingCubes isosurface as a glTF/GLB for Blender.
// Carries geometry + MeshPhysicalMaterial Principled-friendly params.
// Procedural organic looks (moss hair, rock displacement, foam pores) are
// rebuilt in Blender — see docs/blender-materials.md.
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import type { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { exportMaterialParams, type ExportMaterialParams } from './organicMaterials';
import { exportLiquidMaterialParams } from './liquidMaterials';
import type { LiquidParams } from './liquidPresets';

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Clone the live isosurface into a Mesh with MeshPhysicalMaterial and
 * return a binary GLB Blob.
 */
export async function buildGlbBlob(
  source: MarchingCubes,
  materialPresetId: string,
  liquidParams?: LiquidParams | null,
): Promise<Blob> {
  if (!source || source.count === 0) {
    throw new Error('No 3D mesh to export yet — wait for the isosurface to build.');
  }

  // Bake current draw range into a compact BufferGeometry.
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
  geo.computeBoundingSphere();

  // Apply the scene scale so Blender gets a sensible object size.
  const scale = source.scale.x;
  geo.scale(scale, scale, scale);

  const p: ExportMaterialParams = liquidParams
    ? exportLiquidMaterialParams(liquidParams)
    : exportMaterialParams(materialPresetId);
  const mat = new THREE.MeshPhysicalMaterial({
    color: p.color,
    roughness: p.roughness,
    metalness: p.metalness,
    ...(p.transmission != null ? { transmission: p.transmission } : {}),
    ...(p.ior != null ? { ior: p.ior } : {}),
    ...(p.thickness != null ? { thickness: p.thickness } : {}),
    ...(p.attenuationColor != null ? { attenuationColor: p.attenuationColor } : {}),
    ...(p.attenuationDistance != null
      ? { attenuationDistance: p.attenuationDistance }
      : {}),
    ...(p.clearcoat != null ? { clearcoat: p.clearcoat } : {}),
    ...(p.clearcoatRoughness != null
      ? { clearcoatRoughness: p.clearcoatRoughness }
      : {}),
    ...(p.sheen != null ? { sheen: p.sheen } : {}),
    ...(p.sheenColor != null ? { sheenColor: p.sheenColor } : {}),
    ...(p.sheenRoughness != null ? { sheenRoughness: p.sheenRoughness } : {}),
    ...(p.iridescence != null ? { iridescence: p.iridescence } : {}),
    ...(p.iridescenceIOR != null ? { iridescenceIOR: p.iridescenceIOR } : {}),
    ...(p.iridescenceThicknessRange != null
      ? { iridescenceThicknessRange: p.iridescenceThicknessRange }
      : {}),
    ...(p.dispersion != null ? { dispersion: p.dispersion } : {}),
    ...(p.transmission != null && p.transmission > 0
      ? { transparent: true, depthWrite: false }
      : {}),
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'MetaballMark';

  const scene = new THREE.Scene();
  scene.add(mesh);

  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(scene, {
    binary: true,
    onlyVisible: true,
  });

  mat.dispose();
  geo.dispose();

  if (result instanceof ArrayBuffer) {
    return new Blob([result], { type: 'model/gltf-binary' });
  }

  return new Blob([JSON.stringify(result)], { type: 'model/gltf+json' });
}

/**
 * Clone the live isosurface and download it as a .glb file.
 */
export async function exportGlb(
  source: MarchingCubes,
  materialPresetId: string,
  name = 'metaball-mark',
  liquidParams?: LiquidParams | null,
): Promise<void> {
  const blob = await buildGlbBlob(source, materialPresetId, liquidParams);
  const ext = blob.type.includes('json') ? 'gltf' : 'glb';
  downloadBlob(blob, `${name}.${ext}`);
}
