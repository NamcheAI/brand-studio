# `@namche/metaball-react`

Embeddable React/Three.js renderer for NAMCHE metaball marks. It defaults to
the current **Namche Loop**, has no Studio state or stylesheet dependency, and
supports multiple independent instances on one page.

## React / Vite

```tsx
import { Metaball3D } from '@namche/metaball-react';

export function BrandMark() {
  return (
    <Metaball3D
      preset="loop"
      material="wax"
      interactive
      autoRotate
      style={{ width: 'min(70vw, 720px)' }}
    />
  );
}
```

The component supplies a square aspect ratio by default. Pass `width`, `height`
or `aspectRatio` through `style` to fit the host layout.

Static scenes render only when their state changes. Set `autoRotate` for the
built-in camera rotation, or `renderContinuously` when the host animates the
shape itself and needs a frame for every update.

## Next.js

Three.js needs a browser canvas, so load the component as a client-only chunk:

```tsx
'use client';

import dynamic from 'next/dynamic';

const Metaball3D = dynamic(
  () => import('@namche/metaball-react').then((module) => module.Metaball3D),
  { ssr: false },
);

export function BrandMark() {
  return <Metaball3D preset="loop" material="wax" interactive={false} autoRotate />;
}
```

Lazy loading is recommended on any site because Three.js is intentionally not
part of the initial 2D/page bundle.

## Custom shape

```tsx
<Metaball3D
  shape={{
    nodes: [
      { r: 1, c: 1, size: 'L' },
      { r: 3, c: 3, size: 'XL' },
    ],
    edges: [['1-1', '3-3']],
    neck: 0.55,
    blur: 9,
    contrast: 22,
    pinch: 0.2,
  }}
/>
```

`shape` takes precedence over `preset`. Material can be a preset id or Three.js
`MeshPhysicalMaterialParameters`. The component ref exposes its canvas, mesh
and `invalidate()` without any global state.

## Environment map

Reflective and transmissive materials (chrome, glass, honey and most other
presets except wax and clay) light the mark with a studio HDR. By default it is
drei's `studio` preset, fetched from a public CDN on first use. To avoid that
third-party request, host the file yourself and pass its URL:

```tsx
<Metaball3D material="chrome" environmentUrl="/hdri/studio_small_03_1k.hdr" />
```

The preset file is Poly Haven's
[Studio Small 03](https://polyhaven.com/a/studio_small_03) (CC0). If the
environment cannot be loaded, the mark still renders, without reflections, and
a warning is logged; the host page is never unmounted by a failed request.

## Peer dependencies

The host application provides React, React DOM, Three.js,
`@react-three/fiber`, and `@react-three/drei`. This prevents duplicate React or
Three instances in the Brand site bundle.

Package releases use the repository's trusted-publishing workflow. See
[`../docs/RELEASING.md`](../docs/RELEASING.md).

## Credits

Original Metaball Studio concept, design direction, and implementation
(now NAMCHE Brand Studio) by [Michael Marte](https://github.com/fizzybubbele)
for [Ruhm etc.](https://ruhmetc.com/). Package extraction and engineering are by
the NAMCHE contributors listed in the repository `AUTHORS.txt` and
`CONTRIBUTORS.txt`.

## License

MIT. The Namche name and logos remain trademarks; the software license does
not grant trademark rights or permission to imply endorsement. See
[`LICENSE`](LICENSE) for details.
