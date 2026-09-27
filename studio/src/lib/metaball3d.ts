import {
  blurFromGooStd,
  isolationFromThreshold,
  resolveMetaballShape,
  updateMarchingCubesField as updateRendererField,
  type MetaballShape,
} from '@namche/metaball-react';
import type { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import type { Document } from './model';

/** High quality is kept for the Studio's export and surface-sampler path. */
export const MC_RESOLUTION = 96;

export { blurFromGooStd, isolationFromThreshold };

export function toMetaball3DShape(
  doc: Pick<
    Document,
    | 'nodes'
    | 'edges'
    | 'edgeFactors'
    | 'edgePulls'
    | 'tubeFactor'
    | 'inwardPull'
    | 'gooStd'
    | 'gooThreshold'
  >,
): MetaballShape {
  return {
    nodes: doc.nodes,
    edges: doc.edges,
    edgeFactors: doc.edgeFactors,
    edgePulls: doc.edgePulls,
    neck: doc.tubeFactor,
    pinch: doc.inwardPull,
    blur: doc.gooStd,
    contrast: doc.gooThreshold,
  };
}

/** Studio adapter around the renderer's canonical Marching Cubes field. */
export function updateMarchingCubesField(mc: MarchingCubes, doc: Document): void {
  updateRendererField(mc, resolveMetaballShape(toMetaball3DShape(doc)));
}
