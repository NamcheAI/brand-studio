# Optional material tuning

Full recipes live in [studio/docs/blender-materials.md](../../../../studio/docs/blender-materials.md).

Reminder: default handoff always uses the universal staged prompt. These notes are look-specific after Stage 1 classifies the reference.

| Look | Geometry driver | Shading notes |
|------|-----------------|---------------|
| Harz+Moos | Moss growth mask + Hair Curves (body undisplaced) | Amber transmission resin + green/brown hair |
| Fels | Noise + Voronoi → Set Position / Displace | Matte rock ColorRamp; roughness ~0.82–0.96 |
| Schaum | Voronoi F1 cells → Displace (surface dimples only) | SSS / transmission peach foam |
| Coral / Weavy porous | **Membrane-first lattice** — see skill `metaball-porous-lattice` | CoralPorcelain cream + moderated periwinkle ridge glaze |
| Myzel | Voronoi distance-to-edge hyphae | Pale flesh + violet cavities; low SSS |

Always: weld → shared Factor → geometry first → shading second → lighting last.

Coral through-cells are **not** Schaum displace and **not** Voronoi→PointsToVolume.
Use `blender-handoff-new/` + membrane-first script / skill.
