# Universal prompt — transfer a reference texture/material onto existing geometry (Blender MCP)

This is the manual, standalone version of what `Export for Blender` generates
in `HANDOFF.md` for any material + reference image pair. There are no named
preset recipes in the handoff path anymore — Fels / Harz+Moos / Schaum in the
app are live 3D stand-ins only. Optional tuning notes still live in
[docs/blender-materials.md](blender-materials.md). Fill in the four
placeholders and paste into a Blender-MCP-connected chat.

```
OBJECT: {OBJECT_NAME}          # e.g. "Dumbbell" — the mesh already in the scene
REFERENCE_IMAGE: {REFERENCE_IMAGE_PATH}   # e.g. "/refs/rock_material.jpg"
WORKDIR: {WORKDIR}             # e.g. "./blender-handoff" — palette JSON + screenshots land here
SPEED_RUN_DRAFT: {true|false}  # default true for unfamiliar refs; false for known pairs

Goal: apply the surface irregularity, material, and color palette from
REFERENCE_IMAGE onto OBJECT, without altering OBJECT's geometry silhouette,
proportions, or camera framing. Work in stages: plan/baseline → analyze →
(optional speed-run draft) → geometry → shading → (optional) lighting. Use
the Blender MCP tools to execute this directly in the scene — do not just
describe it.

Tools to use (by name): get_scene_info, get_object_info, execute_blender_code,
get_viewport_screenshot. For Stage 4 HDRIs (and Stage 3 fallback only):
get_polyhaven_status, search_polyhaven_assets, download_polyhaven_asset,
set_texture.

Every stage ends in a CHECK. Run it, report pass/fail with evidence, and do
not start the next stage until it passes. On fail, use the VERIFY LOOP below
— do not skip ahead.

────────────────────────────────────────
VERIFY LOOP — closed-loop multimodal (code → render → vision → revise)
────────────────────────────────────────
Use this loop for every CHECK that produces or depends on a screenshot
(Stages 2, 3, 4; also Stage 0 baseline capture). Stage 1.5 (speed-run
draft) is a single-pass exception — one screenshot, family check only, no
revision budget. Numeric-only CHECKs (bbox %, camera identity, file exists)
still run first; vision revises what numbers cannot catch.

1. EXECUTE — apply the stage's Blender changes via execute_blender_code.
2. RENDER — get_viewport_screenshot → the stage's WORKDIR path
   (overwrite on retries, or write `_r1` / `_r2` suffixes if you need a trail).
3. VERIFY (vision) — compare the screenshot to the stage target:
   - Stage 2: silhouette vs 00_before.png + REFERENCE_IMAGE surface scale
   - Stage 3: palette / pattern scale / roughness vs REFERENCE_IMAGE
   - Stage 4: lighting mood vs REFERENCE_IMAGE without washing material
   State pass/fail with 1–3 concrete observations (not vibes).
4. REVISE — on fail: list 1–3 parameter fixes (e.g. lower Displace 20%,
   shift ColorRamp stop, raise Bump), execute them, return to step 2.
5. BUDGET — max 2 revision cycles per stage (3 screenshots total).
   After budget exhausted:
   - Stage 2: stop and report (do not break silhouette further)
   - Stage 3: Poly Haven texture fallback (see CHECK 3), then one more
     verify; if still fail, stop
   - Stage 4: revert to prior world/lights and stop

Spatial checks (every geometry-affecting revise):
- Bounding box within 3% of STAGE 0 on every axis
- Camera location/rotation unchanged
- Working copy must not intersect or swallow the backdrop plane if one exists

────────────────────────────────────────
Guard rails (never violate):
- Do not move, reframe, or change the active camera after STAGE 0.
- Do not scale, rotate, or relocate OBJECT.
- Do not delete or modify the clean original mesh.
- Do not apply modifiers or sculpt passes that change the silhouette beyond
  the Stage 2 bounding-box tolerance.
- Do not displace an unwelded mesh (see MESH PREFLIGHT) — that causes a
  diamond-lattice artifact that looks like a UV problem but is not.
- Do not assume Noise/Voronoi Fac spans 0–1 — measure, then normalize.
- Write ColorRamp colors in linear (convert sRGB hex → linear before setting
  Blender sockets). Using raw hex/sRGB is a common source of palette drift.
- Note Blender version from STAGE 0 — Principled BSDF socket names differ in
  4.x (Transmission Weight, Coat Weight, Subsurface Weight).

────────────────────────────────────────
MESH PREFLIGHT — weld before any displacement (mandatory)
────────────────────────────────────────
Marching-Cubes / glTF exports often arrive as loose triangles: vertex count
≈ 3 × face count, every edge a boundary. Displacing that along normals moves
each triangle independently → diamond lattice. Missing UVs are a red herring;
welding is the fix.

On the working copy (draft and textured), before SurfaceDriver / Displace:
1. Measure: verts, faces, boundary-edge count (or non-manifold).
2. If verts ≈ 3 × faces OR boundary edges ≈ all edges: Merge by Distance
   (weld). Re-measure — expect a large vert drop and ~0 non-manifold /
   boundary-heavy topology fixed. Dimensions must stay identical to ≥5
   decimals.
3. Shade Smooth; optional Weighted Normal after the geometry irregularity
   pass (not before weld).
CHECK PREFLIGHT: report before/after vert counts; confirm weld ran when
the loose-triangle pattern was detected. Never skip this because "we will
UV unwrap later."

────────────────────────────────────────
STAGE 0 — Plan and baseline
────────────────────────────────────────
1. get_scene_info + get_object_info(OBJECT). Record:
   - Blender version and active renderer
   - OBJECT vertex/face count (flag if verts ≈ 3 × faces — weld required)
   - world-space bounding-box dimensions (X/Y/Z)
   - active camera location and rotation
2. get_viewport_screenshot → WORKDIR/00_before.png.
   This is the "before" half of the final comparison; do not move the camera
   again after this shot.
3. State the concrete plan before touching the scene: intended node names
   (including NodeGroup `SurfaceDriver`), modifier / Geometry Nodes stack,
   expected strength range, whether subdivision will be needed, and that
   MESH PREFLIGHT weld runs first.
CHECK 0: baseline numbers reported in chat, 00_before.png exists on disk,
loose-triangle risk flagged if present.

────────────────────────────────────────
STAGE 1 — Analyze the reference
────────────────────────────────────────
1. Load REFERENCE_IMAGE with PIL/numpy and extract:
   - the 4–6 dominant colors (hex + RGB), in proportion order
   - an approximate roughness/porosity description (smooth vs pitted vs
     cracked vs grainy) based on local contrast/edge density
   - whether the pattern reads as banded, mottled, veined, or uniform
2. Save the extracted palette to WORKDIR/palette.json using this schema:
   dominant_colors[], roughness_porosity, pattern,
   colorramp_stops_suggested[{position, hex, rgb_norm, role}].
   Store both sRGB hex and linear rgb_norm; Stage 3 writes linear values
   into Blender ColorRamp sockets.
   Do not eyeball colors from memory in later stages — read this file.
CHECK 1: palette.json exists; 4–6 dominant colors; pattern classified as one
of banded / mottled / veined / uniform; linear channels present.

────────────────────────────────────────
STAGE 1.5 — Speed-run draft (only if SPEED_RUN_DRAFT is true)
────────────────────────────────────────
Cheap direction check before committing to full VERIFY LOOPs. Skip entirely
when SPEED_RUN_DRAFT is false (known object/ref pair, clear reference, or
repeat look).

1. Duplicate OBJECT as `{OBJECT}_draft` (separate from the later
   `{OBJECT}_textured` working copy). Hide the clean original.
2. Run MESH PREFLIGHT weld on the draft before any displace.
3. Build a minimal SurfaceDriver (or temporary Noise+Voronoi) — do not
   enable Adaptive Subdivision. Displace Strength at the low end (~0.01).
4. Slap a rough Principled + ColorRamp from palette.json (linear stops)
   onto the draft — no Image Texture mix, no Poly Haven, no Stage 4.
5. get_viewport_screenshot → WORKDIR/01_draft.png (single pass — no
   VERIFY LOOP revisions).
6. Vision check (family only): does this read as the same material family
   as REFERENCE_IMAGE (rock-like / foam-like / resin-like / etc.) with
   plausible pattern scale? Not final fidelity. If you see a diamond
   lattice / shattered facets, stop — weld failed or was skipped.
CHECK 1.5:
- PASS → note chosen Noise/Voronoi scales + Displace ballpark; delete or
  hide `{OBJECT}_draft`; proceed to SHADER PROCEDURE / Stage 2 with those
  starting values on `{OBJECT}_textured`.
- FAIL → change strategy once (different Mix Fac, scale, or Voronoi vs
  Noise emphasis), re-shoot 01_draft.png once. If still fail, stop and
  report — do not enter Stage 2 polishing the wrong family.
Draft is disposable. Never polish 01_draft.png into the final; Stage 2+
rebuilds properly on `{OBJECT}_textured`.

────────────────────────────────────────
SHADER PROCEDURE — shared driver (build once, reuse)
────────────────────────────────────────
Build the driver once in Stage 2 (shader NodeGroup and/or Geometry Nodes).
Do not rebuild a second independent noise tree in Stage 3 — colour must
land in the same physical crevices as the displacement. Prefer
Texture Coordinate → Object (or the same object-space fields in GN) so
the look is UV-independent. A final material with 0 UV-driven links is fine
and often preferable for metaball isosurfaces.

Preferred signal stack (sum / mix into a signed height, then a 0–1 Factor
for shading). Scales are starting guesses — always MEASURE (below):
  - Voronoi distance-to-edge cracks (large scale) × occasional FBM mask
  - Voronoi F1 pits (finer scale)
  - Ridged multifractal or high-detail Noise for relief
  - Fine FBM grit
Cracks/pits carve inward; add a small calibrated bias so the bounding box
returns to the Stage 0 size after displacement.

MEASURE before wiring Map Range / ColorRamp windows (mandatory):
Sample or emit each signal as grayscale and record min / mean / max (or
histogram). Do not assume Fac ≈ 0.5 ± 0.1. Dead signals (e.g. ridged mean
~0.08, Voronoi pits outside your window, grit window past the distribution)
produce flat / wrong-colour materials even when the graph "looks right."
Rebuild normalization from the measured windows. If a bias term was hiding
a constant offset, remove that compensation after fixing the windows.

Stage 2 wires (geometry) — after MESH PREFLIGHT weld:
  Prefer Geometry Nodes: Subdivide Mesh (as needed) → Set Position along
  Normal by the signed height stack (one hero amplitude dial, e.g. Crack
  Amp). Fallback: Displace modifier driven by the same Factor.
  Start conservative; raise only while CHECK 2 bbox gate passes.
  Optional: Weighted Normal after the irregularity pass.

Stage 3 wires (shading — same object-space stack):
  Factor / cavity masks → ColorRamp (linear stops from palette.json)
                       → Principled Base Color
  Optional regional mask (large FBM) to blend stone vs accent (rust/moss)
  ramps; apply cavity darkening + fine dark speckle over both so accent
  faces still pit correctly.
  Factor → Roughness (lower on ridges, higher in cavities; rock-like
  starting band ~0.82–0.96 when the reference is matte stone)
  Fine Bump for micro-porosity below mesh resolution
  Metallic = 0 unless REFERENCE_IMAGE is visibly metallic (rock ~0.02 ok)

Optional image layer (only after procedural palette reads correctly):
  Prefer box/triplanar projection with Soft Light (or similar) at ~40–55%
  over a straight MixRGB Color 30–50%. Straight colour mixes often paste
  the photo's baked mid-tones, lift shadows, and score worse against the
  extracted palette. A/B with a numeric distance to palette.json when
  possible; keep the winner. Judge image-layer variants under Stage 4
  (or equivalent) lighting — flat ambient hides whether grain helps.

────────────────────────────────────────
STAGE 2 — Make the surface irregular (geometry, first)
────────────────────────────────────────
1. Duplicate OBJECT as `{OBJECT}_textured`. Hide (do not delete) the clean
   original so it stays available for comparison.
2. Run MESH PREFLIGHT weld. If Stage 1.5 already welded a draft, still weld
   this copy — do not assume linked data.
3. Build SurfaceDriver / Geometry Nodes stack per SHADER PROCEDURE. Prefer
   Set Position along Normal over Displace-on-loose-tris. Keep amplitude
   low enough that the silhouette holds; use one hero dial after the rest
   is calibrated.
4. Subdivide only as needed for the displacement to read. Measure each
   noise signal and set normalization windows from data.
5. Run VERIFY LOOP → WORKDIR/02_geometry.png.
CHECK 2: get_object_info — bbox within 3% of STAGE 0 (tighter is better;
calibrated bias should get near-zero drift); camera byte-identical; no
diamond lattice; vision pass on surface scale vs REFERENCE_IMAGE. On fail,
revise inside the loop (usually lower amplitude / fix weld) — do not
proceed to Stage 3 until pass or budget exhausted.

────────────────────────────────────────
STAGE 3 — Apply material and color (shading, second)
────────────────────────────────────────
1. Build a Principled BSDF material on `{OBJECT}_textured`.
2. Wire Stage 3 per SHADER PROCEDURE — same object-space stack into linear
   ColorRamp stops from palette.json, Roughness remap, and Bump.
   Do not create a new unrelated noise tree.
3. If the procedural pass already matches palette/pattern, skip the image
   layer. If grain is still missing, add Soft Light box/triplanar mix and
   A/B against palette distance — do not keep a mix that worsens the score.
4. Leave Metallic at 0 unless the reference is visibly metallic.
5. Run VERIFY LOOP → WORKDIR/03_material.png.
CHECK 3: vision vs REFERENCE_IMAGE on (a) palette, (b) pattern scale,
(c) roughness/porosity. If the material looks flat / uniformly tinted,
re-MEASURE signal distributions before tweaking ramps. After 2 failed
revisions: Poly Haven texture fallback mixed 30–50%, then one more verify.
Report clearly if no longer purely procedural.

────────────────────────────────────────
STAGE 4 — Lighting/background (optional, separate from material)
────────────────────────────────────────
Only if asked. Scene concern, not material — but run it before final
image-layer A/B judgments when an image layer is in play.
1. Prefer a Poly Haven HDRI: get_polyhaven_status →
   search_polyhaven_assets(asset_type="hdris") → download_polyhaven_asset,
   tuned to the mood of REFERENCE_IMAGE.
2. Or a simple 3-point setup + seamless backdrop plane (backdrop colour
   may be sampled from reference corners).
3. Run VERIFY LOOP → WORKDIR/04_lit.png.
CHECK 4: vision pass — lighting mood vs REFERENCE_IMAGE without washing
out Stage 3 material; no subject/backdrop intersection. On budget fail,
revert world/lights to pre-Stage-4 state.

────────────────────────────────────────
FINAL REPORT
────────────────────────────────────────
Report back in this fixed shape:
1. Mesh preflight: before/after vert counts, weld yes/no
2. Node graph summary (signals, measured min/mean/max → normalization
   windows, hero amplitude dial) plus ColorRamp stops (confirm linear),
   Roughness remap, Bump
3. Extracted palette actually used (from palette.json) + any palette-
   distance score if computed
4. Modifier / Geometry Nodes stack with final strengths
5. Every CHECK's pass/fail, revision count, vision observations, image-
   layer A/B choice, Poly Haven fallback, SPEED_RUN_DRAFT verdict
6. Before/after: WORKDIR/00_before.png vs the last stage screenshot
   (03_material.png, or 04_lit.png if Stage 4 ran)

Handoff (not a CHECK — only if a beauty still is wanted next):
Material transfer is done. For a beauty / style still, run the separate
render-style prompt in docs/blender-render-style-prompt.md with
RENDER_STYLE set to hyperrealistic | product | lookdev | clay. Do not fold
that pass into these stages.
```

**Notes**
- This is written for an agent driving Blender's Python API (via MCP), not an image-gen model — it builds real shader nodes and modifiers instead of hallucinating pixels.
- Weld before displace. Diamond lattice after Displace on a metaball GLB is almost always loose triangles, not missing UVs.
- Measure noise Fac distributions before Map Range windows — assumed 0–1 centres are how you get flat pink stones.
- ColorRamp stops are linear; convert from sRGB hex.
- Geometry (Stage 2) before shading (Stage 3); same object-space stack for both. Soft Light box-project beats naive Mix Color for photo grain.
- VERIFY LOOP mandatory for stages 2–4; Stage 1.5 is single-pass only.
- SPEED_RUN_DRAFT defaults to true for unfamiliar refs; false to skip.
- Poly Haven textures only after revision budget; Stage 4 HDRIs are the normal Poly Haven path. Run lighting before final image-layer A/B.
- Beauty stills: separate prompt — [blender-render-style-prompt.md](blender-render-style-prompt.md).
- Lessons above were proven on a Fels/rock closed-loop run (weld 76k→12k verts; measured ridged/Voronoi/FBM windows; Soft Light ref layer best palette distance).
