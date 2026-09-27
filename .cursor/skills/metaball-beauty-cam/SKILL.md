---
name: metaball-beauty-cam
description: >-
  Metaball beauty stills and turntable camera orbits via Blender MCP after
  materials are done. Styles hyperrealistic / product / lookdev / clay; 360
  turntable with PNG sequence + ffmpeg. Use when the user asks for a beauty
  render, product still, turntable, orbit video, showcase spin, or
  blender-render-style after a successful material handoff.
---

# Metaball beauty cam

Run **after** `metaball-blender-handoff` (or equivalent) has passed material
CHECKs. Do not rebuild SurfaceDriver, displace, or Principled graphs here
(except temporary clay override).

## Modes

| Mode | When |
|------|------|
| **Still** | Single beauty frame — follow render-style prompt |
| **Turntable** | 360 orbit video — bpy below + ffmpeg |

## Still — render style

Read and execute:

- [studio/docs/blender-render-style-prompt.md](../../../studio/docs/blender-render-style-prompt.md)

Placeholders: `OBJECT`, `WORKDIR`, `RENDER_STYLE` ∈
`hyperrealistic | product | lookdev | clay`, optional `REFERENCE_IMAGE`.

MCP: `get_scene_info`, `get_object_info`, `execute_blender_code`,
`get_viewport_screenshot`, Poly Haven HDRI tools when needed.

Output: `WORKDIR/05_{RENDER_STYLE}.png`. VERIFY LOOP max 2 per stage.

## Turntable — orbit video

Patterned on kevinbadi turntable skills; drive via **ahujasid blender-mcp**
(`execute_blender_code`), not a second WebSocket toolkit.

### Prerequisites

- Textured OBJECT in scene; materials already verified
- ffmpeg available for encode
- Output dir: `{WORKDIR}/beauty_cam/` (or `~/Desktop/Blender Videos/metaball/`)

### Parameters

| Param | Default | Notes |
|-------|---------|-------|
| `duration` | `5` | seconds |
| `fps` | `24` | |
| `camera_distance` | auto | transformed bbox fit to horizontal + vertical FOV |
| `camera_height` | `0.35 * distance` | soft hero angle |
| `camera_lens` | `50` | mm |
| `transparent_bg` | `true` | film_transparent |
| `samples` | `64` | Cycles + denoise |
| `output_format` | `mov` | ProRes 4444 alpha; or `webm` |

### Flow

1. **Record material-pass camera** (location/rotation) so it can be restored.
2. **Optional front pick:** render 4 low-res facings (front/right/back/left);
   ask user which is front — or default −Y if they skip.
3. **Rig:** empty at object world center → camera parented → TRACK_TO →
   keyframe empty Z-rotation 0→360° with **LINEAR** interpolation.
4. **Lights:** soft warm key + cool fill (organic brandmark — not chrome
   product polish). Prefer keeping Stage 4 world/HDRI if it already works.
5. **Render** PNG sequence (RGBA) via Cycles GPU if available.
6. **Encode** with ffmpeg (MCP may time out during animation render — poll
   frame count, then encode).

Canonical bpy + ffmpeg: [scripts/turntable_setup.py](scripts/turntable_setup.py)
and [scripts/encode_turntable.sh](scripts/encode_turntable.sh). Paste/adapt
via `execute_blender_code`; substitute `OBJECT_NAME`, paths, and params.

### Guard rails

- Do not edit SurfaceDriver / materials (clay stills are the only exception;
  restore after if asked).
- Do not use kevinbadi `product-polish` glossy clearcoat defaults — wrong for
  Fels / Harz / Schaum / Myzel.
- Restore original camera after the turntable if the user still needs the
  material-pass framing.
- Silhouette / bbox of OBJECT must stay unchanged.

## Report

Stills: style settings + CHECK results + path to `05_*.png`.  
Turntable: frame count, encode path, front angle used, whether camera restored.
