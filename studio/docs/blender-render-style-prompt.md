# Universal prompt — beauty / render-style pass (Blender MCP)

Run this **after** the material transfer prompt in
[blender-texture-transfer-prompt.md](blender-texture-transfer-prompt.md) (or an
equivalent staged material job) has already passed its CHECKs. Do not rebuild
materials or displace geometry here — this prompt only owns the beauty still.

Fill in the placeholders and paste into a Blender-MCP-connected chat.

```
OBJECT: {OBJECT_NAME}                 # textured mesh already in the scene
WORKDIR: {WORKDIR}                    # e.g. "./blender-handoff"
RENDER_STYLE: {RENDER_STYLE}          # hyperrealistic | product | lookdev | clay
REFERENCE_IMAGE: {REFERENCE_IMAGE_PATH_OR_NONE}  # optional mood cue; ignore if NONE

Goal: produce a final beauty still of OBJECT in RENDER_STYLE without altering
OBJECT's geometry, materials, silhouette, or camera framing from the material
pass. Use the Blender MCP tools to execute this directly — do not just describe
it.

Tools: get_scene_info, get_object_info, execute_blender_code,
get_viewport_screenshot. For HDRIs when needed: get_polyhaven_status,
search_polyhaven_assets, download_polyhaven_asset.

Every stage ends in a CHECK. On fail, use the VERIFY LOOP — do not skip ahead.

────────────────────────────────────────
VERIFY LOOP — closed-loop multimodal (code → render → vision → revise)
────────────────────────────────────────
1. EXECUTE — apply style/render settings via execute_blender_code.
2. RENDER — get_viewport_screenshot (or full render for Stage 2) → stage path.
3. VERIFY (vision) — compare to RENDER_STYLE intent (+ REFERENCE_IMAGE mood
   if set). State pass/fail with 1–3 concrete observations.
4. REVISE — on fail: 1–3 fixes (exposure, samples, light strength, DOF,
   backdrop value), re-render, re-verify.
5. BUDGET — max 2 revision cycles per stage. After budget: keep best still,
   report remaining defects; do not invent new materials to "fix" style.

Spatial checks: camera unchanged unless the style plan documented a framing
change; subject must not intersect/swallow the backdrop; bbox of OBJECT
unchanged from material-pass baseline.

Guard rails:
- Do not edit SurfaceDriver, Displace strengths, or Principled graphs from the
  material pass (unless a style explicitly requires a temporary override —
  clay only — and restore afterward if asked).
- Do not move the camera unless RENDER_STYLE requires a documented framing
  change (default: keep the material-pass camera).
- Do not conflate this with material transfer. If the material still looks
  wrong, stop and re-run the transfer prompt instead.

────────────────────────────────────────
STAGE 0 — Confirm scene + style plan
────────────────────────────────────────
1. get_scene_info + get_object_info(OBJECT). Confirm the textured object exists
   and note current renderer, samples, and world/lights.
2. If WORKDIR/03_material.png or 04_lit.png exists, treat that as the baseline
   look; otherwise get_viewport_screenshot → WORKDIR/05_before_style.png.
3. State the style plan: which preset below, samples target, whether DOF /
   compositor / new HDRI will be used.
CHECK 0: OBJECT present; RENDER_STYLE is one of the four presets; plan stated.

────────────────────────────────────────
STAGE 1 — Apply RENDER_STYLE
────────────────────────────────────────
Switch to Cycles unless already on it. Apply exactly one preset:

### hyperrealistic
- Samples: 256–512 (or adaptive to similar quality); OptiX/OIDN denoise on.
- Filmic or AgX view transform; slight contrast; exposure matched to subject.
- Soft DOF if the subject is hero-scale (f-stop high enough not to smear
  surface detail).
- Subtle contact shadow / ground plane if none exists; avoid crushing blacks.
- If REFERENCE_IMAGE is set: borrow mood (warm/cool, contrast), not pixel
  identity — do not override the finished material palette.

### product
- Clean seamless backdrop (light grey / soft gradient). Softbox-style area
  lights; controlled speculars; low drama.
- Samples 128–256 + denoise. Minimal or no DOF. High clarity on edges.
- Neutral white balance; no heavy grading.

### lookdev
- Neutral studio HDRI (Poly Haven if needed) + low-contrast grey world.
- Even lighting so albedo/roughness read clearly; no cinematic grade.
- Samples 64–128 + denoise. No DOF. Purpose: material QA, not marketing.

### clay
- Temporary override: single mid-grey Principled (Roughness ~0.45, Metallic 0)
  on OBJECT only — keep geometry/displacement. Or a dedicated clay material
  slot if already set up.
- Soft HDRI or 3-point; samples 64–128. Shows form only.
- Note in the report that materials were overridden for this still.

Optional for all styles: Poly Haven HDRI via search_polyhaven_assets
(asset_type="hdris") when the current world fights the style — prefer
adjusting lights before replacing a Stage-4 world that already works.

CHECK 1: run VERIFY LOOP on a viewport still — reads as the chosen style;
surface detail from the material pass still visible (except clay).

────────────────────────────────────────
STAGE 2 — Final still
────────────────────────────────────────
1. Run VERIFY LOOP with a full/high-quality render →
   WORKDIR/05_{RENDER_STYLE}.png (e.g. 05_hyperrealistic.png).
2. Optionally save a second camera angle only if asked —
   WORKDIR/05_{RENDER_STYLE}_alt.png — without changing materials.
CHECK 2: file exists; resolution usable (≥ material-pass screenshots);
vision pass — no fireflies / underexposure that hides the subject; style
intent still holds at final quality.

────────────────────────────────────────
FINAL REPORT
────────────────────────────────────────
1. RENDER_STYLE applied + key settings (samples, denoise, view transform,
   DOF on/off, HDRI name if used)
2. Whether REFERENCE_IMAGE mood was used or ignored
3. Any temporary overrides (clay) and whether they were restored
4. Every CHECK's pass/fail, revision count, and vision observations
5. Path to WORKDIR/05_{RENDER_STYLE}.png
```

**Notes**
- Sibling to the texture-transfer prompt, not a Stage 5 inside it. Keep them
  separate so material CHECKs stay objective.
- VERIFY LOOP is the same closed-loop pattern as the transfer prompt:
  code → render → vision → revise (max 2).
- `lookdev` is the right style when debugging SurfaceDriver / palette; 
  `hyperrealistic` / `product` are presentation passes.
- Finish materials via the transfer prompt first
  ([blender-texture-transfer-prompt.md](blender-texture-transfer-prompt.md)),
  then run this.
