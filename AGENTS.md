# Working on NAMCHE Brand Studio

This repository is designed for visual, iterative work in Cursor as well as for
normal TypeScript development. Preserve the visual intent, keep the package
boundaries below, and make small changes that can be previewed quickly.

## Start here

```bash
npm install
npm run dev
```

The Studio opens at `http://localhost:5173`. Before handing off a change, run:

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

Do not edit generated `dist/` files. The build creates them.

## Where a change belongs

| You want to change… | Work in… |
| --- | --- |
| the 2D mark geometry, presets, rasterization, or SVG output | `core/src/` |
| the reusable 3D viewer, camera, field, or organic material presets | `renderer/src/` |
| Studio controls, document state, motion, liquid, export, or Blender handoff | `studio/src/` |
| AI render contracts, server adapters, or API routes | `studio/lib/` and `studio/server/` |
| app colors and typography | `studio/src/index.css` using tokens from `@namche/design-tokens` |
| Blender-agent instructions | `.cursor/skills/` and `studio/docs/` |

Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) before moving code across
these boundaries.

## Safe visual workflow

1. Run the Studio and reproduce the current look before editing.
2. Change one concern at a time.
3. Check both 2D and 3D. For 3D, rotate the object and test a narrow viewport.
4. Test the default **Namche Loop** first, then one asymmetric preset such as R.
5. If geometry changes, run `npm run bake` and review the SVG diffs visually.
6. Keep the default viewer light. Liquid, surface sampling, GLB and Blender
   handoff are Studio features and do not belong in the public renderer.

Canonical presets share the inner 3 × 3 authoring frame.
`ENGINE.BRANDMARK_PATH` is the intentionally full-bleed official asset source;
use the framed `brandmark` preset (or `ENGINE.BRANDMARK_PRESET_PATH`) inside the
Studio and renderer.

Public uppercase data belongs under the frozen `ENGINE` namespace. Keep root
named exports for functions and types lowercase/PascalCase-safe; adding loose
uppercase constants makes design-system compilers treat them as components.

## Public renderer contract

`@namche/metaball-react` is the component intended for the NAMCHE Brand page.
Its main API is `Metaball3D`; it must remain independent of Studio `Document`
state and support more than one instance on a page. Never add a module-global
canvas or mesh handle. Use the component ref (`Metaball3DHandle`) instead.

When changing the renderer:

- preserve the no-CSS-import integration;
- keep `preset="loop"` as the default;
- keep React, Three, R3F and Drei as peer dependencies;
- avoid Studio-only dependencies and post-processing in the default path;
- update `renderer/README.md` and its public types when props change;
- test Next.js examples as client components (`dynamic(..., { ssr: false })`).

Registry releases follow [`docs/RELEASING.md`](docs/RELEASING.md). Do not run
`npm publish` as an incidental part of feature work.

The core and renderer packages are MIT-licensed. Keep their `LICENSE` files in
the npm artifacts. The license does not grant trademark rights in the Namche
name or logos, and the private Studio is not part of the public package grant.

## Studio rules

- The Toolbar edits state; renderers display it. Do not read DOM controls from a
  renderer.
- Materials appear only in 3D. Raster colors appear only in 2D.
- The Namche raster is optional appearance, not part of the exported mark.
- Expensive overlays stay opt-in and must dispose geometry, materials, timers,
  animation frames and event listeners on unmount.
- Keep 3D code lazy-loaded so the 2D Studio does not download Three.js.
- Keep AI/provider credentials on the server. Never expose them through
  `VITE_*`, browser state, client bundles, exported documents, or logs.
- Treat AI material rendering as a camera-view study: browser geometry remains
  canonical, while provider prompts and parameters stay generic enough for
  coral, nacre, moss, fur, stone, metal, and future material families.
- Mock paid providers in automated tests. Never spend API credits in CI.
- Persisted document changes require a version/migration update in
  `studio/src/lib/persistence.ts` and tests.

## Brand and credits

The current design tokens live in the sibling `design` repository. Pull its
`main` branch before a brand-system change. GAIA and semantic role colors are
UI tokens; OKEANOS/HELIOS and the raster colors are editorial/diagram colors,
not generic product chrome.

The Studio header uses two distinct generated brand assets: the transparent
Basalt mark at `studio/public/namche-mark.svg`, and the Rhododendron avatar at
`studio/public/favicon.svg`. Refresh both from `../design` with
`npm run build:brand-assets`; do not reuse the coloured favicon as an in-app
logo or redraw either path by hand.

Keep credits in `README.md`, `AUTHORS.txt`, and `CONTRIBUTORS.txt`. Michael
Marte's design/development credit and Ruhm etc. attribution must not be removed
when files are moved or rewritten.

## Pull requests

Open implementation work as a draft. Make it ready only after the checks above
pass. Address review feedback on the current commit, then merge only with green
required checks and no unresolved actionable threads.
