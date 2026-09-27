# Metaball Cursor skills

Project skills for the Metaball → Blender MCP pipeline. Agents should prefer
these over generic Blender / Meshy / texture-diffusion guides.

| Skill | Role |
|-------|------|
| [metaball-blender-handoff](metaball-blender-handoff/SKILL.md) | Default material transfer (staged VERIFY LOOP) |
| [metaball-porous-lattice](metaball-porous-lattice/SKILL.md) | Coral / through-porosity membrane-first geometry |
| [metaball-surface-driver](metaball-surface-driver/SKILL.md) | Shared Factor geometry ↔ shading contract |
| [metaball-diffgrow](metaball-diffgrow/SKILL.md) | Optional differential-growth organic pass |
| [metaball-beauty-cam](metaball-beauty-cam/SKILL.md) | Beauty stills + turntable after materials |
| [metaball-stablegen](metaball-stablegen/SKILL.md) | Optional StableGen bake spike (opt-in only) |

**WORKDIR (porous coral):** `blender-handoff-new/` — see skill `metaball-porous-lattice` for lessons + file table.  
`blender-handoff/` is the older fels rock package only.

Canonical long prompts remain in `studio/docs/`:

- `blender-texture-transfer-prompt.md`
- `blender-materials.md`
- `blender-render-style-prompt.md`
