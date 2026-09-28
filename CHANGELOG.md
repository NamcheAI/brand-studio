# Changelog

## `@namche/brand-studio` — Unreleased

- Rename the app from Metaball Studio to **NAMCHE Brand Studio**, moving the
  workspace from `editor/` to `studio/` and the npm workspace package from
  `metaball-editor` to `@namche/brand-studio`. The public `@namche/metaball`,
  `@namche/metaball-react` and `@namche/metaball-svg` packages, their folders,
  and the metaball geometry itself are unchanged.
- Restructure the UI around the main flows: a tab per flow (Mark, Object,
  Images, Library) under a shared app bar, a File menu, a persistent playback
  bar, generated renders shown on stage, and Expert sections for advanced
  controls.
- Migrate the persisted document's storage key for the new structure; see
  `studio/src/lib/persistence.ts` for the version bump and migration.

## `@namche/metaball` 2.0.0 — Unreleased

- **Breaking:** Replace loose uppercase root exports with the frozen `ENGINE`
  namespace. Functional and type exports remain unchanged; migrate
  `import { VIEWBOX }` to `import { ENGINE }` and read `ENGINE.VIEWBOX`.

- Fit the `brandmark`/Classic Mark preset to the same inner authoring frame as
  Loop and R in both 2D and 3D.
- Export `BRANDMARK_PRESET_PATH` separately from the unchanged full-bleed
  `BRANDMARK_PATH` used to build official brand assets.
- Migrate saved version 10 Classic documents to the shared inner grid.

## `@namche/metaball-react` 0.2.0 — Unreleased

- Consume the namespaced `@namche/metaball` 2.x data API. The renderer's own
  public component API is unchanged.

## `@namche/metaball` 1.0.0 — 2026-08-19

- First public release of the deterministic 2D metaball geometry engine.
- Includes the canonical Namche Loop preset and SVG generation APIs.

## `@namche/metaball-react` 0.1.0 — 2026-08-19

- First public release of the embeddable React and Three.js renderer.
- Includes the Namche Loop default, organic material presets, responsive
  camera fitting, demand rendering, and independent multi-instance support.

Both packages are released under the MIT License. The Namche name and logos
remain trademarks; the license does not grant trademark rights or permission
to imply endorsement.
