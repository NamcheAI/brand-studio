// Pack a Blender MCP handoff zip: mesh.glb + obj-preview.png + optional ref + HANDOFF.md.
import { zipSync } from 'fflate';
import type { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { buildGlbBlob, downloadBlob } from './export3d';
import { getMaterialPreset } from './materialPresets';
import { exportMaterialParams } from './organicMaterials';

/** Presets that ship a look-reference image under public/handoff-refs/. */
export const HANDOFF_REF_PRESETS = new Set(['resin_moss', 'rock', 'foam']);

/** A reference image packed into the handoff zip, bundled or user-attached. */
export type RefImageBytes = { bytes: Uint8Array; fileName: string };

/**
 * Universal staged recipe for any object/reference pair — inline version of
 * docs/blender-texture-transfer-prompt.md (no preset-specific branches).
 */
function buildUniversalStagedSteps(ref: string): string {
  return `3. **Stage 0 — plan and baseline** (before any edits):
   - \`get_scene_info\` + \`get_object_info\`: record Blender version, renderer, vertex count, world-space bounding box, camera location/rotation.
   - \`get_viewport_screenshot\` → \`00_before.png\`. Do not move the camera after this.
   - State the concrete plan (NodeGroup \`SurfaceDriver\`, modifier stack, expected Displace strength) before touching the scene.
   - Default \`SPEED_RUN_DRAFT: true\` for unfamiliar refs (set false to skip Stage 1.5).
   - **Mesh preflight:** if verts ≈ 3× faces (loose Marching Cubes tris), Merge by Distance before any displace — diamond lattice is a weld bug, not missing UVs.
4. **Analyze ${ref}** (PIL/numpy) for 4–6 dominant colors + surface character; save \`palette.json\` with sRGB hex **and linear** channels (ColorRamp gets linear).
5. **Stage 1.5 — speed-run draft** (only if \`SPEED_RUN_DRAFT\` is true; else skip):
   - Duplicate as \`*_draft\`; **weld first**; minimal SurfaceDriver; Displace ~0.01; rough linear ColorRamp; no Adaptive Subdiv, no Poly Haven, no lighting.
   - Single screenshot → \`01_draft.png\`. Vision: same material family as ${ref}? Lattice → weld failed. One strategy retry max; draft is disposable.
6. **Stage A — geometry irregularity** (before any shading):
   - Duplicate working copy; hide clean original; **weld again** on this copy.
   - Prefer Geometry Nodes Set Position along Normal (object-space Voronoi cracks/pits + ridged/FBM grit) with one hero amplitude dial; else Displace. **Measure** each signal's min/mean/max and set Map Range windows from data — do not assume Fac ≈ 0.5.
   - VERIFY LOOP → \`02_geometry.png\`. Bbox within 3% (calibrated bias toward ~0 drift); no lattice; camera untouched.
7. **Stage B — material and color** (same object-space stack — do not rebuild a second noise tree; UV-free is fine):
   - Principled + linear ColorRamp from \`palette.json\`; cavity/roughness/bump from the same signals.
   - Optional photo grain: Soft Light box/triplanar of ${ref} ~40–55%, A/B vs palette distance — avoid straight Mix Color 30–50% (washes shadows). Judge image-layer under Stage C lighting.
   - VERIFY LOOP → \`03_material.png\`. Flat/wrong tint → re-measure signal windows before tweaking ramps. Poly Haven only after 2 failed revisions.
8. **Stage C — lighting** (only after geometry + material read correctly; only if asked):
   - Prefer a Poly Haven HDRI (\`search_polyhaven_assets(asset_type="hdris")\` → \`download_polyhaven_asset\`) tuned to ${ref}, or a simple 3-point setup + backdrop. Keep this separate from the material step.
   - VERIFY LOOP → \`04_lit.png\`; on budget fail revert world/lights.
   - Closed loop for screenshot stages 2–4: code → render → vision → revise (max 2), then stage fallback. Stage 1.5 is single-pass only.`;
}

/** Steps 3+ of "Blender MCP steps": universal staged recipe when a ref image is available, else a plain fallback. */
function buildStepsBody(refFileName: string | null): string {
  const refMention = refFileName ? `\`${refFileName}\`` : 'the reference image';

  if (refFileName) {
    return `${buildUniversalStagedSteps(refMention)}
9. **Verify (closed loop)** — re-read \`get_object_info\`: bounding box within 3% of the pre-displacement baseline, camera untouched. For each screenshot stage (not the draft): code → \`get_viewport_screenshot\` → vision critique vs ${refMention} → revise (max 2) → fallback if budget exhausted. Report before/after (\`00_before.png\` vs last stage), draft verdict if any, node-graph summary, palette used, modifier strengths, CHECK pass/fail, revision counts, and vision observations.
10. **Beauty still (optional, separate prompt)** — only if asked: run \`docs/blender-render-style-prompt.md\` with \`RENDER_STYLE\` = \`hyperrealistic\` | \`product\` | \`lookdev\` | \`clay\`. Do not fold that into the material stages above.`;
  }

  return `3. Refine the Principled material from the exported params.
4. Set up studio / dramatic lights as needed.
5. Take a viewport screenshot to verify against \`obj-preview.png\`.`;
}

async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png');
  });
  if (blob) {
    return new Uint8Array(await blob.arrayBuffer());
  }
  // Fallback when toBlob is unavailable (some WebGL contexts).
  const dataUrl = canvas.toDataURL('image/png');
  const res = await fetch(dataUrl);
  return new Uint8Array(await res.arrayBuffer());
}

async function waitFrames(count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }
}

/** Bundled look-reference for the three organic stand-ins, packed as `ref.jpg`. */
async function fetchBundledRef(presetId: string): Promise<RefImageBytes | null> {
  if (!HANDOFF_REF_PRESETS.has(presetId)) return null;
  const url = `${import.meta.env.BASE_URL}handoff-refs/${presetId}.jpg`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return { bytes: new Uint8Array(await res.arrayBuffer()), fileName: 'ref.jpg' };
  } catch {
    return null;
  }
}

function buildHandoffMarkdown(opts: {
  presetId: string;
  refFileName: string | null;
}): string {
  const preset = getMaterialPreset(opts.presetId);
  const p = exportMaterialParams(opts.presetId);
  const ref = opts.refFileName;

  const paramLines = [
    `- Base Color: \`${p.color}\``,
    `- Roughness: \`${p.roughness}\``,
    `- Metalness: \`${p.metalness}\``,
  ];
  if (p.transmission != null) paramLines.push(`- Transmission: \`${p.transmission}\``);
  if (p.ior != null) paramLines.push(`- IOR: \`${p.ior}\``);
  if (p.thickness != null) paramLines.push(`- Thickness: \`${p.thickness}\``);
  if (p.attenuationColor != null) {
    paramLines.push(`- Attenuation Color: \`${p.attenuationColor}\``);
  }
  if (p.clearcoat != null) paramLines.push(`- Clearcoat: \`${p.clearcoat}\``);
  if (p.sheen != null) paramLines.push(`- Sheen: \`${p.sheen}\``);

  const lookGoal = ref
    ? `Apply the surface texture, material, and color palette of \`${ref}\` onto the mesh in \`mesh.glb\`. Preserve the object's exact shape, form, and proportions — do not alter its geometry. Use \`obj-preview.png\` only as a camera/shape check (live stand-in material). Match the lighting mood from \`${ref}\` where relevant.

Follow the universal staged workflow (optional \`SPEED_RUN_DRAFT\` → SurfaceDriver + VERIFY LOOP) — geometry first, then shading that reuses the same Factor, then lighting only if asked. Full prompt: \`docs/blender-texture-transfer-prompt.md\`. Don't bundle stages into one pass.`
    : `Keep the exported Principled-friendly base from \`mesh.glb\` (params below). Use \`obj-preview.png\` as a shape/camera check. Improve look in Cycles if needed, but do not change the mesh topology.`;

  return `# Metaball → Blender handoff

Live stand-in: **${preset.label}** (\`${opts.presetId}\`) — editor preview / GLB base only. Blender finish uses the reference image + universal prompt below (not a named preset recipe).

## Package
- \`mesh.glb\` — exact metaball isosurface + base Principled params
- \`obj-preview.png\` — live editor 3D preview (geometry / framing)
${ref ? `- \`${ref}\` — material / lighting look target\n` : ''}- \`HANDOFF.md\` — this file

## Prompt for Blender MCP

${lookGoal}

Exported Principled starting point:
${paramLines.join('\n')}

## Blender MCP steps
1. Import \`mesh.glb\` (File → Import → glTF 2.0, or via MCP \`execute_blender_code\`). Duplicate it and keep the clean original untouched.
2. Shade Smooth; optional Weighted Normal if facets show.
${buildStepsBody(ref)}

## Tips
- Apply Shade Smooth and a modest Weighted Normal if Marching Cubes triangulation looks faceted.
- Remesh / Decimate only if needed for hair or sculpting.
`;
}

export type BlenderHandoffOptions = {
  source: MarchingCubes;
  materialPresetId: string;
  /** When set, GLB carries liquid MeshPhysical params instead of organic preset. */
  liquidParams?: import('./liquidPresets').LiquidParams | null;
  liquidPresetId?: string;
  /** Live WebGL canvas from the 3D view. */
  canvas: HTMLCanvasElement;
  /** Force a few demand-frameloop redraws before snapshot. */
  invalidate?: () => void;
  /** User-attached reference image; overrides the bundled default for any preset. */
  customRef?: RefImageBytes | null;
};

/**
 * Build and download metaball-blender-handoff.zip for Blender MCP.
 */
export async function exportBlenderHandoff(opts: BlenderHandoffOptions): Promise<void> {
  const {
    source,
    materialPresetId,
    liquidParams,
    liquidPresetId,
    canvas,
    invalidate,
    customRef,
  } = opts;

  if (invalidate) {
    for (let i = 0; i < 4; i++) invalidate();
  }
  await waitFrames(6);

  const presetIdForDocs = liquidParams
    ? `liquid:${liquidPresetId ?? 'custom'}`
    : materialPresetId;

  const [glbBlob, previewBytes, bundledRef] = await Promise.all([
    buildGlbBlob(source, materialPresetId, liquidParams),
    canvasToPngBytes(canvas),
    customRef || liquidParams
      ? Promise.resolve(null)
      : fetchBundledRef(materialPresetId),
  ]);
  const ref = customRef ?? bundledRef;

  const glbBytes = new Uint8Array(await glbBlob.arrayBuffer());
  const handoffMd = buildHandoffMarkdown({
    presetId: presetIdForDocs,
    refFileName: ref?.fileName ?? null,
  });
  const mdBytes = new TextEncoder().encode(handoffMd);

  const files: Record<string, Uint8Array> = {
    'mesh.glb': glbBytes,
    'obj-preview.png': previewBytes,
    'HANDOFF.md': mdBytes,
  };
  if (ref) {
    files[ref.fileName] = ref.bytes;
  }

  const zipped = zipSync(files, { level: 6 });
  const zipBuf = zipped.buffer.slice(
    zipped.byteOffset,
    zipped.byteOffset + zipped.byteLength,
  ) as ArrayBuffer;
  downloadBlob(new Blob([zipBuf], { type: 'application/zip' }), 'metaball-blender-handoff.zip');
}
