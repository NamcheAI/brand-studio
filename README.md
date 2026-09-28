# Metaball Generator

The engine behind the NAMCHE brandmark vocabulary, plus the Brand Studio for
making marks with it.

Nodes sit on a grid and are drawn as circles; connections between them are
drawn as capsules. The union is blurred and re-thresholded, which pulls
neighbouring forms into one organic shape — _"vom Schachbrett zum Netzwerk"_
expressed as a computation.

```bash
npm install
npm run dev      # the Studio
npm test         # engine + studio features
npm run lint     # the Studio
```

## What is where

| Path            | What it is                                                                   |
| --------------- | ---------------------------------------------------------------------------- |
| `core/`         | `@namche/metaball` — the engine. Dependency-free, deterministic, TypeScript. |
| `renderer/`     | `@namche/metaball-react` — embeddable React/Three.js Brand-page viewer.      |
| `studio/`       | NAMCHE Brand Studio: 2D authoring, live 3D, AI material studies, and export. |
| `assets/marks/` | The canonical marks, baked to SVG + JSON.                                    |
| `scripts/`      | `bake-assets.mjs`, `sync-design.mjs`.                                        |

The Studio imports the engine — there is one implementation of the geometry,
not two. A change to how marks are drawn shows up in the Studio, in the baked
assets and in the design system together, or not at all.

The normal 3D material view also runs through the public renderer package.
Studio adds its advanced liquid, surface-sampler, AI material-render and export
workflows around that component rather than exposing the Studio document as a public API.
See [`renderer/README.md`](renderer/README.md) for Brand-page integration and
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the dependency boundaries.

### NAMCHE Brand Studio

The Studio turns the same authored node graph into several non-destructive
views:

- the canonical 2D graph/metaball renderer and flattened SVG/PNG export;
- a live Three.js Marching Cubes isosurface with material and liquid looks;
- growth plus deterministic loop motions;
- server-side, prompt-driven high-fidelity material studies from the current 3D view;
- GLB export and a Blender handoff bundle with preview and material reference.

Three.js is loaded only when the 3D view is opened. Studio-only settings extend
the Studio document, while nodes, edges, necks, blur, contrast, and pinch always
map back through `@namche/metaball`.

## Using the engine

```js
import { generate, generateSvg, generateMaskToken } from "@namche/metaball";

const { d, viewBox } = generate({ preset: "trio" }); // path data
const svg = generateSvg({ preset: "r", fill: "#000" }); // standalone <svg>
const mask = generateMaskToken({ seed: "namche" }); // CSS mask token
```

Engine data is grouped under one frozen namespace:

```js
import { ENGINE } from "@namche/metaball";

ENGINE.VIEWBOX;
ENGINE.PRESETS;
ENGINE.DEFAULT_THEME;
```

In version 2, migrate loose constant imports such as
`import { PRESETS } from "@namche/metaball"` to `ENGINE.PRESETS`. Functional
exports such as `generate` and all type exports remain at the package root.

With no parameters, `generate()` returns the current Namche `loop` mark.
The legacy `brandmark` preset keeps its approved silhouette as a golden vector,
fitted to the same inner authoring frame as Loop and R, and carries the matching
editable five-node graph used by NAMCHE Brand Studio. `ENGINE.BRANDMARK_PATH`
remains the unframed official asset path for brand-asset generation;
`ENGINE.BRANDMARK_PRESET_PATH` is its Studio-safe framed counterpart.

Give it a `preset`, an explicit `nodes`/`edges` spec, or a `seed` — in that
order of precedence. The same input always produces the same path, so baked
assets are reproducible and diffs mean something.

```js
generate({ seed: "namche", count: 5, extraEdges: 1 });
generate({
  nodes: [
    { r: 1, c: 1, size: "L" },
    { r: 3, c: 3, size: "XL" },
  ],
  edges: [["1-1", "3-3"]],
});
```

### The parameters that shape a mark

| Param        | Default | What it does                                                |
| ------------ | ------- | ----------------------------------------------------------- |
| `neck`       | `0.55`  | Capsule thickness before blur, relative to the smaller node |
| `blur`       | `9`     | Fusion width — how far forms reach for each other           |
| `contrast`   | `22`    | Alpha cutoff; higher = sharper waist, tighter neck          |
| `pinch`      | `0`     | `0` barbell tubes … `1` pinched metaball                    |
| `detail`     | `0.9`   | Simplification tolerance, in view units                     |
| `resolution` | `1`     | Supersampling, 1–4. Adds contour detail, not size           |

`pinch` thins the tubes, so blur is boosted to compensate
(`blur · (1 + pinch · 0.65)`) and the forms still fuse.

Per-edge overrides go in `edgeFactors` / `edgePulls`, keyed by the sorted
`"a|b"` edge key — that is how a single joint gets a tighter neck than the
rest of the mark.

### Two rasterizers, one result

Tracing needs a blurred coverage field. There are two ways to get one, and
`generate` picks automatically (`backend: 'auto'`):

- **canvas** — browser only, fast, and the reference these marks were designed
  against. Used for the Studio's live preview and export.
- **pure** — signed-distance rasterization plus the SVG spec's three-box-blur
  approximation of a Gaussian. No DOM, so it runs in Node, in CI and in
  workers. This is what bakes the static assets.

Both feed the same marching-squares tracer, Douglas–Peucker simplification and
Catmull–Rom smoothing, so they agree to well under a pixel. Force one with
`backend: 'canvas' | 'pure'` when you need to compare them.

## Baking assets

```bash
npm run bake
```

Writes `assets/marks/metaball-<id>.svg` and a matching `.json` spec for every
canonical mark. The SVG is what consumers use; the JSON re-opens in the Studio,
so a mark is never a dead end. Commit both — an unexpected diff here is the
review signal that a shape moved.

## Feeding the design system

The design repo consumes the built engine as plain files: no build step, no
`node_modules`, importable by the Claude Design project and by a React wrapper
alike.

```bash
npm run build:core
npm run sync:design                  # engine → ../design/generator/
npm run sync:marks                   # marks  → ../design/assets/shapes/generated/
npm run sync:design -- --check       # verify, non-zero exit if stale
npm run sync:marks -- --check
```

Every synced engine file gets a header naming the version and source commit,
plus a `.sync-manifest.json` of SHA-256 hashes, so the design repo can verify
its copy without needing access to this one.

The marks land in `assets/shapes/generated/`, kept apart from the
Figma-exported vectors in `assets/shapes/` — those stay canonical, and a
generated form is a new form rather than a replacement for a drawn one.

The direction is one-way. This repo is the source of truth; both destinations
are build artefacts that happen to be committed.

## Provenance

The Studio was reconstructed from a deployed production bundle (no sourcemaps)
and verified against it: for an identical document, the rendered canvas SVG and
the flatten export path matched byte for byte. That parity is why the canvas
backend is kept — it is the reference the existing marks were drawn against.

Two deliberate departures from the original:

- **Flatten resolution.** The original left contour coordinates in
  device-pixel space at `resolution > 1`; here they are scaled back to the
  viewBox, so higher resolutions add detail rather than size.
- **Edge-clipped contours.** Forms touching the raster edge used to stitch
  into open fragments; the field is now sampled through a one-pixel zero
  border so every contour closes.

## Credits

The original Metaball Studio concept, design direction, and implementation
(now NAMCHE Brand Studio) are by [Michael Marte](https://github.com/fizzybubbele)
for [Ruhm etc.](https://ruhmetc.com/).

The production-bundle reconstruction, canonical engine extraction, renderer
package architecture, and ongoing integration are maintained by the NAMCHE
engineering contributors listed in [`AUTHORS.txt`](AUTHORS.txt) and
[`CONTRIBUTORS.txt`](CONTRIBUTORS.txt). Michael's full original editor source is
preserved in git history (commit `7c580c9`) and on the
`michael/editor-full-source` branch.

## License

The public `@namche/metaball` and `@namche/metaball-react` packages are
available under the [MIT License](core/LICENSE). Their package distributions
retain the license and the contributor credits above.

The Namche name and logos remain Namche trademarks. The MIT License does not
grant trademark rights or permission to imply endorsement. The Studio
application remains private and is not part of the public package license. The
SIL Open Font License used by Namche Shadow applies to the fonts only.
