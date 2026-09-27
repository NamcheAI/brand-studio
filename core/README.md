# `@namche/metaball`

Dependency-free, deterministic geometry engine for the NAMCHE metaball mark
vocabulary. It produces SVG path data, complete SVGs and CSS mask tokens from
canonical presets, explicit node graphs or seeded layouts.

```js
import { ENGINE, generate, generateSvg } from '@namche/metaball';

generate(); // current Namche Loop
generate({ preset: 'r' });
generateSvg({ preset: 'trio', fill: '#262626' });
console.log(ENGINE.VIEWBOX, ENGINE.PRESETS);
```

The `brandmark` preset fits the approved Classic silhouette to the common
inner authoring frame. Use `ENGINE.BRANDMARK_PRESET_PATH` for that framed
vector and the full-bleed `ENGINE.BRANDMARK_PATH` only when producing official
logo assets.

Configuration, preset, and canonical-path values live under the frozen
`ENGINE` namespace. Version 2 removes loose uppercase root exports so
component-oriented consumers do not mistake engine data for UI components.

Full API and geometry documentation live in the repository
[`README.md`](../README.md).

Original Metaball Studio concept, design direction, and implementation
(now NAMCHE Brand Studio) by [Michael Marte](https://github.com/fizzybubbele)
for [Ruhm etc.](https://ruhmetc.com/).

## License

MIT. The Namche name and logos remain trademarks; the software license does
not grant trademark rights or permission to imply endorsement. See
[`LICENSE`](LICENSE) and the repository credits for details.
