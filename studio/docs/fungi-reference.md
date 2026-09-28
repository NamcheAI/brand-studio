# Fungi reference → Metaball

Design principles distilled from
[Pentagram — *Mushrooms: The Art, Design and Future of Fungi*](https://www.pentagram.com/work/mushrooms-the-art-design-and-future-of-fungi)
and mapped onto this brandmark editor.

## Principles (source)

1. **Grid as archive** — A systematic grid frames works like specimens in a scientific catalogue.
2. **Grown forms** — Letterforms and assets are digitally “grown” (mycelium simulation), not drawn as fixed outlines.
3. **Fertile / infertile** — Positive and negative zones control where growth is allowed.
4. **Structure vs organic** — Rigid gridlines contrast with soft, mutating organic shapes and motion crops.
5. **Digital → physical** — Unique growths leave the tool as 3D prints in the gallery.

## Mapping to the metaball system

| Principle | Editor concept |
|---|---|
| Grid as archive | 5×5 cell field: outer ring (`Theme.pink`) + inner canvas (`Theme.blue`); toggle via Show grid |
| Fertile / infertile | Inner 3×3 (`isInner`) = fertile / editable; outer ring = infertile catalogue frame unless Full grid |
| Grown forms | Metaball isosurface from nodes + edges; **Grow** playback reveals radii along a BFS of the graph |
| Structure vs organic | Graph mode (circles + connectors) vs metaball mode (goo blend); grid stays on during growth |
| Digital → physical | Export SVG/PNG/JSON; 3D showcase + Export GLB / Export for Blender handoff |

### Concepts (code)

- `Theme` — pink / blue / ink / bg in `src/lib/model.ts`
- Document graph — `nodes`, `edges`, goo / tube params
- Modes — `graph` \| `metaball`; views — `2d` \| `3d`
- Materials — live PBR presets in `src/lib/materialPresets.ts` (including **Myzel**); Blender recipes in `docs/blender-materials.md`
- Growth — non-destructive display scales in `src/lib/growth.ts` (does not mutate saved radii)

## Constraints

- The brandmark remains a **node/edge mark on the grid**, not a generative typeface.
- We do **not** clone Pentagram’s Hypha interactive tool or 3D-print pipeline.
- Growth playback is ephemeral: Stop restores authored geometry; export and history ignore transient scales.
