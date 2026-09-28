// MeshPhysicalMaterial factory from the 3D liquid settings.
// Live 3D liquid preview prefers MeshTransmissionMaterial in Metaball3DPreview;
// this MeshPhysical path is for GLB export and fallback.
import * as THREE from 'three';
import { liquidAttenuationDistance, liquidSurfaceColor, type LiquidParams } from './liquidPresets';
import type { ExportMaterialParams } from './organicMaterials';

/** Live MeshPhysicalMaterial for the liquid look mode.
 *  Tint lives in attenuationColor — surface color stays near-white so transmission isn't eaten. */
export function createMaterialFromLiquid(params: LiquidParams): THREE.MeshPhysicalMaterial {
  const rim = params.rimStrength;
  return new THREE.MeshPhysicalMaterial({
    color: liquidSurfaceColor(params.tint),
    roughness: params.roughness,
    metalness: 0,
    transmission: params.transmission,
    ior: params.ior,
    thickness: 1.0 + params.transmission * 0.6 + params.opacity * 0.4,
    attenuationColor: params.tint,
    attenuationDistance: liquidAttenuationDistance(params),
    clearcoat: 0.55 + (1 - params.roughness) * 0.45,
    clearcoatRoughness: Math.min(1, params.roughness * 0.65 + 0.03),
    iridescence: rim,
    iridescenceIOR: 1.2 + rim * 0.15,
    iridescenceThicknessRange: [80 + rim * 40, 400 + rim * 400],
    dispersion: params.dispersion * 0.85,
    envMapIntensity: 0.7 + params.transmission * 0.85,
    specularIntensity: 1,
    specularColor: '#ffffff',
    flatShading: false,
    transparent: true,
    depthWrite: params.transmission > 0.5 ? false : true,
  });
}

/** Principled-friendly params for glTF export. */
export function exportLiquidMaterialParams(params: LiquidParams): ExportMaterialParams {
  const rim = params.rimStrength;
  return {
    color: liquidSurfaceColor(params.tint),
    roughness: params.roughness,
    metalness: 0,
    transmission: params.transmission,
    ior: params.ior,
    thickness: 1.0 + params.transmission * 0.6 + params.opacity * 0.4,
    attenuationColor: params.tint,
    attenuationDistance: liquidAttenuationDistance(params),
    clearcoat: 0.55 + (1 - params.roughness) * 0.45,
    clearcoatRoughness: Math.min(1, params.roughness * 0.65 + 0.03),
    iridescence: rim > 0.01 ? rim : undefined,
    iridescenceIOR: rim > 0.01 ? 1.2 + rim * 0.15 : undefined,
    iridescenceThicknessRange: rim > 0.01 ? [80 + rim * 40, 400 + rim * 400] : undefined,
    dispersion: params.dispersion > 0.01 ? params.dispersion * 0.85 : undefined,
  };
}
