# Architecture

NAMCHE Metaball has three layers. The dependency direction is one-way:

```text
@namche/metaball (core geometry)
              ↓
@namche/metaball-react (embeddable 3D viewer)
              ↓
Metaball Studio (authoring UI and advanced workflows)
```

## Core — `@namche/metaball`

Dependency-free TypeScript for deterministic nodes, edges, presets, 2D
rasterization, tracing and SVG output. It is the source of truth for the
Namche Loop and other canonical graphs. It does not know about React, Three.js,
the editor, materials or browser UI.

## Renderer — `@namche/metaball-react`

The reusable Brand-page component. It maps a core preset or `MetaballShape` to
a Three.js Marching Cubes field, frames the camera and applies a lightweight
physical material. It owns its canvas and all disposable Three.js resources.

The renderer intentionally exposes a small API: shape, material, background,
interaction, rotation, quality and sizing. It has no editor toolbar, persistence,
liquid controls, surface sampler, export workflow or global live-mesh singleton.

## Studio — `editor/`

The application layer. It owns the `Document`, history, persistence, 2D graph
authoring, motion, liquid looks, surface sampling, AI material studies,
GLB/PNG/SVG/JSON export and Blender handoff. `Metaball3DPreview` is an adapter:

- ordinary physical materials render through public `Metaball3D`;
- liquid and sampler modes use the advanced Studio scene;
- both paths share renderer field, material and camera code.

The separate `/studio/images` entry point creates Hestia field, Filter and
Close-up image studies. Its provider and durable, browser-private history live
in `editor/lib/` and `editor/server/`; image studies are independent of the
Metaball `Document`. The shared `/studio/library` pairs immutable prompt versions
with image and 3D render outputs. 3D assets contain a serialized Document and
camera/reference captures, while core and the public renderer remain unaware of
storage. See [`IMAGE_STUDIO.md`](IMAGE_STUDIO.md).

High-fidelity AI material rendering is deliberately a Studio workflow, not a
browser renderer feature. The browser captures the current 3D canvas and may
attach a separate material reference. The authenticated `/api/render` endpoint
normalizes generic intent parameters, composes explicit image roles and calls a
provider adapter with its server-only credential. The generated image is a
material study of that camera view; it is not a new mesh or a reusable texture
map. See [`AI_RENDERING.md`](AI_RENDERING.md).

## Performance contract

- 3D is lazy-loaded from `App.tsx`.
- The public viewer defaults to `balanced` voxel quality; Studio uses `high`
  where export fidelity matters.
- Static material views render on demand. Auto-rotation, host-driven Studio
  motion and liquid render continuously.
- Marching Cubes fields may debounce rapid editor updates.
- Every Three.js allocation, timer and animation frame must be disposed or
  cancelled on unmount.

## Extending the system

Add a new canonical shape in `core/src/presets.ts`. Add a broadly reusable
physical material in `renderer/src/materials.ts`. Add experimental looks,
editor-only switches, provider-backed image generation and export workflows in
`editor/`. If a feature needs the whole Studio `Document`, a private credential
or a paid API, it is not part of the public renderer API.
