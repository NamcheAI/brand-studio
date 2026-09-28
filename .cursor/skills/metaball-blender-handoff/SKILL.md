---
name: metaball-blender-handoff
description: >-
  Run the Metaball Blender MCP material-transfer handoff: import GLB, weld
  Marching Cubes mesh, SurfaceDriver geometry then shading, VERIFY LOOP
  (screenshot + vision), optional lighting. Use when the user exports for
  Blender, opens a HANDOFF.zip / HANDOFF.md, asks to transfer a reference
  material onto a metaball, or mentions Fels / Harz+Moos / Schaum / Myzel
  Blender texturing. For coral / through-porosity / Weavy lattice, also load
  metaball-porous-lattice.
---

# Metaball Blender handoff

Execute the staged material transfer in Blender via MCP. Do not only describe it.

## Source of truth

Read and follow the full prompt (placeholders + every stage CHECK):

- [studio/docs/blender-texture-transfer-prompt.md](../../../studio/docs/blender-texture-transfer-prompt.md)

Optional look tuning (not the default export path):

- [studio/docs/blender-materials.md](../../../studio/docs/blender-materials.md)

SurfaceDriver Factor contract (geometry ↔ shading):

- Skill `metaball-surface-driver`

**Coral / trabecular through-porosity** (membrane-first lattice — not SurfaceDriver dimples):

- Skill `metaball-porous-lattice` (canonical lessons + file table)
- WORKDIR `blender-handoff-new/` + `metaball_porous_white.blend`
- Do **not** use `blender-handoff/` (`fels_rock.blend`) for that look — older rock pass
- Do **not** retry: thick sphere-boolean punches, Voronoi→PointsToVolume popcorn, interior-only cells, heavy post-nub volume-fuse
- Next leap when asked: SDF = inside letter-r **and** near Voronoi edges

After materials pass, beauty stills / turntables are separate skills:

- [studio/docs/blender-render-style-prompt.md](../../../studio/docs/blender-render-style-prompt.md)
- Skills `metaball-beauty-cam`, `metaball-diffgrow` (optional organic pass), `metaball-stablegen` (optional photographic bake — not default)

## Placeholders

Fill from the handoff zip / user:

| Key | Example |
|-----|---------|
| `OBJECT` | mesh name already in scene (or import `mesh.glb`) |
| `REFERENCE_IMAGE` | path to `ref.jpg` / custom ref |
| `WORKDIR` | Prefer `./blender-handoff-new` (coral/porous). `./blender-handoff` = older fels only |
| `SPEED_RUN_DRAFT` | `true` unfamiliar refs; `false` known pairs |

## MCP tools

`get_scene_info`, `get_object_info`, `execute_blender_code`, `get_viewport_screenshot`.  
Stage 4 / Stage 3 fallback: `get_polyhaven_status`, `search_polyhaven_assets`, `download_polyhaven_asset`, `set_texture`.

## Stage order (never bundle)

```
0 plan+baseline → 1 analyze palette → 1.5 optional draft
→ MESH PREFLIGHT weld → 2 geometry (SurfaceDriver) → 3 shading (same Factor)
→ 4 lighting optional → FINAL REPORT
```

Every screenshot stage uses VERIFY LOOP: execute → screenshot → vision pass/fail → revise (max 2). Stage 1.5 is single-pass only.

## Non-negotiable guard rails

- Do not move the camera after Stage 0.
- Do not scale/rotate/relocate OBJECT; keep a clean original duplicate.
- **Weld before displace** (loose tris → diamond lattice).
- Measure Noise/Voronoi Fac min/mean/max before Map Range windows.
- ColorRamp stops in **linear** (sRGB hex → linear).
- Bbox within 3% of Stage 0 on geometry revises.
- Do not rebuild a second noise tree in Stage 3.
- Skip StableGen / texture-diffusion / dream-textures on this default path.

## Quick CHECK list

| Stage | Artifact | Pass means |
|-------|----------|------------|
| 0 | `WORKDIR/00_before.png` | bbox + camera recorded; loose-tri risk flagged |
| 1 | `WORKDIR/palette.json` | 4–6 colors + pattern + linear stops |
| 1.5 | `01_draft.png` | same material family; no diamond lattice |
| 2 | `02_geometry.png` | bbox ≤3%; silhouette holds; surface scale OK |
| 3 | `03_material.png` | palette / pattern / roughness vs ref |
| 4 | `04_lit.png` | mood without washing material |

## Import

If the scene is empty: import `mesh.glb` from the handoff zip (glTF 2.0), then run stages. App presets (Fels / Harz+Moos / Schaum) are live 3D stand-ins only — always match `REFERENCE_IMAGE` via the universal prompt.
