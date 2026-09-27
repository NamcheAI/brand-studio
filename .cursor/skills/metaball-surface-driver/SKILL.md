---
name: metaball-surface-driver
description: >-
  Build and wire the Metaball SurfaceDriver Factor: one object-space
  Noise+Voronoi stack driving Geometry Nodes Set Position / Displace and the
  same Factor into ColorRamp, Roughness, and Bump. Use when creating or fixing
  procedural rock/foam/resin/mycelium shading, diamond-lattice displace bugs,
  flat/wrong ColorRamps, or when the handoff prompt mentions SurfaceDriver.
---

# Metaball SurfaceDriver

One Factor. Geometry first. Shading reuses it. UV-independent (Object coords).

## When to use

- Stage 2–3 of `metaball-blender-handoff`
- User reports diamond lattice, flat tinted stone, or “color doesn’t match bumps”
- Agent is about to build a second noise tree for color — stop and reuse Factor

## Mesh preflight (before any displace)

1. Measure verts / faces / boundary edges.
2. If verts ≈ 3× faces: Merge by Distance (weld). Dimensions unchanged ≥5 decimals.
3. Shade Smooth; Weighted Normal only after irregularity pass.

Skipping weld on metaball GLBs is the usual cause of diamond lattice (not missing UVs).

## Preferred signal stack

Sum/mix into signed height, then a 0–1 Factor for shading:

1. Voronoi distance-to-edge cracks (large) × occasional FBM mask
2. Voronoi F1 pits (finer)
3. Ridged multifractal / high-detail Noise for relief
4. Fine FBM grit

Cracks/pits carve inward; add small calibrated bias so bbox returns to Stage 0.

## MEASURE (mandatory)

Sample each signal grayscale → record min / mean / max. Rebuild Map Range /
ColorRamp windows from data. Do not assume Fac ≈ 0.5 ± 0.1.

## Stage 2 — geometry

Prefer Geometry Nodes: Subdivide (as needed) → Set Position along Normal by
signed height (one hero amplitude dial). Fallback: Displace from same Factor.
Start conservative (~0.01); raise only while bbox stays within 3%.

NodeGroup name: `SurfaceDriver`.

## Stage 3 — shading (same stack)

```
Factor → ColorRamp (linear stops from palette.json) → Base Color
Factor → Roughness remap (lower ridges, higher cavities)
Factor → Bump (micro-porosity)
Metallic = 0 unless reference is metallic
```

Optional Soft Light box/triplanar image layer only after procedural palette
reads correctly (~40–55%). A/B against palette distance; keep the winner.

## Anti-patterns

- Bundling geometry + shading into one unverified pass
- Second independent noise tree for color
- Displace before weld
- Raw sRGB hex into ColorRamp sockets
- Adaptive Subdivision on the Stage 1.5 draft

## Full procedure

See SHADER PROCEDURE in
[studio/docs/blender-texture-transfer-prompt.md](../../../studio/docs/blender-texture-transfer-prompt.md).
