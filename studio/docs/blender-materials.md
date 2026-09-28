# Blender material notes (optional tuning)

The **default Blender path** is the universal staged prompt in
[docs/blender-texture-transfer-prompt.md](blender-texture-transfer-prompt.md)
(also inlined into every `HANDOFF.md`). The sections below are optional
tuning notes for Harz+Moos / Fels / Schaum looks — not what Export for Blender
emits. The editor's 3D view only shows plain PBR stand-ins.

Export from the Metaball editor in **3D**:
- **Export GLB** — mesh + Principled-friendly base only
- **Export for Blender** — zip for Blender MCP (`mesh.glb`, `obj-preview.png`,
  `HANDOFF.md`, and a reference image when one is available)

Then **File → Import → glTF 2.0** (or let Blender MCP import `mesh.glb`). The
GLB carries geometry plus a Principled-friendly base (color, roughness,
metalness, and when set: transmission, IOR, thickness, attenuation, clearcoat,
sheen). Rebuild the organic looks below for production quality — match the
reference image when present.

Use **Cycles** for these recipes. Enable **Experimental** feature set if you
need Adaptive Subdivision.

**Work in stages, in this order, every time:**
1. **Geometry irregularity first** — build the noise/Voronoi node group that
   drives displacement (or the hair-growth mask) before touching shading.
2. **Shading second, reusing the same node group** — feed the *same* pattern
   into the `ColorRamp`/roughness so bumps and color bands correlate; that's
   what makes a procedural material read as physically real instead of
   painted on. Sample actual pixel colors from the reference image — don't
   guess from memory.
3. **Lighting last**, only once geometry and material already read correctly.

Gate each stage with an explicit CHECK and the closed-loop VERIFY LOOP
(code → screenshot → vision critique → revise, max 2). Optional
`SPEED_RUN_DRAFT` runs a single-pass family check (`01_draft.png`) before
full geometry — see the universal prompt in
[docs/blender-texture-transfer-prompt.md](blender-texture-transfer-prompt.md).
That prompt also defines the shared `SurfaceDriver` shader procedure (Noise +
Voronoi → one Factor for Displace, ColorRamp, Roughness, and Bump). Bundling
geometry and shading into one pass, or rebuilding a second noise tree for
color, is the most common way these recipes go wrong.

For a beauty still after materials are done (hyperrealistic, product, lookdev,
clay), use the separate prompt in
[docs/blender-render-style-prompt.md](blender-render-style-prompt.md) — do not
fold render style into the material CHECKs.

Attach a custom reference image in the app's Export panel (it overrides the
bundled default when set); `HANDOFF.md` always uses the universal staged
prompt from
[docs/blender-texture-transfer-prompt.md](blender-texture-transfer-prompt.md).

---

## 1. Resin + moss (Harz+Moos)

**Goal:** translucent amber body with fuzzy green/brown moss patches.

### Stage A — growth pattern (before any shading)

1. Build a moss-growth mask: Noise Texture → ColorRamp (or weight/vertex paint) defining where moss grows — patchy, not uniform.
2. Add **Hair Curves** (or Particle Hair on older Blender), density and length driven by the mask, short and irregular, combed slightly with gravity.
3. Leave the resin body itself undisplaced — the irregularity here comes from hair coverage, not surface bumps.

### Stage B — material and color (reuse the same growth mask from Stage A)

1. Resin body: Principled BSDF —
   - Base Color: warm amber (`#d4a24a`)
   - Roughness: `0.15–0.25`
   - Transmission Weight: `0.7–0.9` (Blender 4+) or Transmission: `0.8`
   - IOR: `1.45`
   - Coat Weight: `0.2`
   - Optional: Volume Absorption (amber) with a low Density for richer depth.
2. Moss hairs: two materials keyed by the same mask — deep green in dense patches, dry brown at thin coverage/edges. Principled Hair BSDF or a high-roughness Principled, no transmission. Sample actual colors from the reference image, don't guess.

### Stage C — lighting (only after geometry + material read correctly)

- Warm key / cool fill tuned to the reference's mood; a touch of backlight helps sell resin translucency.

---

## 2. Craggy rock (Fels)

**Goal:** micro-displacement, matte surface, orange key + cool fill.

### Stage A — geometry irregularity (before any shading)

1. Shared node group: **Noise Texture** (or Musgrave, Detail high, Scale ~4–8) mixed with a finer Noise for grit, plus Voronoi for jagged/fractured edges.
2. Feed into a **Displace** modifier (or Cycles Displacement — see below); keep strength low so the silhouette holds.
3. Cycles: Render Properties → Feature Set **Experimental**; Material Settings → Displacement: **Displacement and Bump**; modifier **Subdivision Surface** → Adaptive Subdivision; wire the noise into the Material Output Displacement socket.

### Stage B — material and color (reuse the same node group from Stage A)

1. New material `Rock`, Principled BSDF.
2. ColorRamp fed by the shared noise → Base Color — sample actual pixel colors from the reference image (light grey ridges, purple-brown recesses is a starting guess, not a substitute for sampling).
3. Same/second noise → Bump, and → Roughness (`0.85–0.95`, lower on flat facets, higher in pits/cracks).
4. Metallic ~`0.02` unless the reference shows real metal.

### Stage C — lighting (only after geometry + material read correctly)

- Warm Area / Spot key from upper-left: `#ff6a20`, strong
- Cool fill from the opposite side: `#9eb6ff`, softer
- Neutral grey/beige world background

---

## 3. Peach foam (Schaum)

**Goal:** porous Voronoi cells with soft SSS / transmission glow.

> **Not coral through-porosity.** Displace here only dimples the surface. For trabecular / Weavy letter-r coral (open through-cells, thin membrane), use skill `metaball-porous-lattice` and `blender-handoff-new/` — never Voronoi→PointsToVolume popcorn or thick boolean punches.

### Stage A — cell/void structure (before any shading)

1. Shared **Voronoi Texture** (F1, Distance, Scale ~8–15) as the driver; optionally mix a second larger-scale Voronoi for irregular voids.
2. Feed into a **Displace** modifier for porous cell depressions; keep strength low so the object's silhouette holds.

### Stage B — material and color (reuse the same Voronoi from Stage A)

1. New material `Foam`, Principled BSDF.
2. Same Voronoi → ColorRamp → Base Color — sample actual pixel colors from the reference image (dark peach in cell centers, brighter peach on walls is a starting guess, not a substitute for sampling).
3. Subsurface Weight: `0.3–0.6` (or Transmission `0.4` + Thickness)
4. Subsurface Radius: warm / reddish
5. Roughness: `0.5–0.65`
6. IOR: `1.3–1.4`

### Stage C — lighting (only after geometry + material read correctly)

- Back or side light so cell walls catch light and the subsurface glow reads. Neutral background.

---

## 4. Mycelium flesh (Myzel)

**Goal:** pale flesh body with a violet cavity network — living mycelium, not plastic.

There is no bundled `ref.jpg` for this preset; attach a custom reference or sample the
editor stand-in (`#E8D4C4` flesh, `#6B3A6E` violet sheen) and follow the universal
staged prompt.

### Stage A — hypha network (before any shading)

1. Shared node group: **Voronoi Texture** (Distance to Edge or F1, Scale ~6–12) mixed with a
   finer Noise/FBM for grit — thin branching recesses, not large crater pits.
2. Feed into Geometry Nodes Set Position along Normal (or Displace); keep strength low
   so the metaball silhouette holds (displacement budget ~0.006–0.015 of object size).
3. One Factor output for all later sockets — do not rebuild a second noise tree for color.

### Stage B — material and color (reuse the same Factor from Stage A)

1. New material `Mycelium`, Principled BSDF.
2. ColorRamp from the shared Factor → Base Color: pale flesh ridges (`#E8D4C4` /
   `#F0E0D2`), muted violet-brown in cavities (`#6B3A6E` / `#423036`). Prefer linear
   stops from a sampled palette when a ref image is attached.
3. Roughness `0.65–0.85` (higher in cavities); Metallic `0`.
4. Optional: light Transmission / SSS (`~0.1–0.2`) with warm attenuation so thin
   regions read alive; Coat low (`~0.05`).
5. Same Factor → Bump for micro-porosity along the hyphae.

### Stage C — lighting (only after geometry + material read correctly)

- Soft warm key, cool fill; avoid hard chrome reflections. Neutral warm-paper backdrop
  works well (`#F3EDE4`).

---

## Tips

- Duplicate the imported mesh and keep a clean original untouched before any heavy displacement or sculpting — this is step 1 in the generated `HANDOFF.md`, not an afterthought.
- **Weld first.** Metaball GLBs often ship as loose triangles (verts ≈ 3× faces). Displacing before Merge by Distance produces a diamond lattice that looks like a UV bug — it is not.
- **Measure** Noise/Voronoi Fac ranges before Map Range windows; assumed 0–1 centres yield flat materials.
- ColorRamp stops: convert sRGB hex → **linear** for Blender.
- Apply **Shade Smooth** and a modest **Weighted Normal** after weld + irregularity if facets show.
- Remesh / Decimate only if you need fewer polygons for hair or sculpting.
- Photo grain: Soft Light box/triplanar usually beats Mix Color for palette fidelity.
