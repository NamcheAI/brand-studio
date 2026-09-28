#!/usr/bin/env node
/**
 * Bake the canonical marks into static SVG files.
 *
 * These are the files designers and consumers reach for; the generator is how
 * they were made, not something anyone has to run to use them. Re-run after
 * changing a preset or the engine, and commit the diff — a surprising diff
 * here means the shape changed, which is exactly the review you want.
 *
 *   npm run bake                 → writes to assets/marks/
 *   npm run bake -- --out <dir>
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ENGINE, generate, generateSvg } from '../core/dist/index.js'

const { PRESETS } = ENGINE

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '..')

const args = process.argv.slice(2)
const outFlag = args.indexOf('--out')
const outDir = outFlag === -1 ? resolve(repo, 'assets/marks') : resolve(args[outFlag + 1])

/** Marks worth shipping as files. Add here when a mark becomes canonical. */
const CANONICAL = ['brandmark', 'r', 'loop', 'trio', 'quad', 'node']

await mkdir(outDir, { recursive: true })

const written = []
for (const id of CANONICAL) {
  const preset = PRESETS.find((p) => p.id === id)
  if (!preset) {
    console.error(`bake: no preset "${id}" — skipping`)
    continue
  }
  const { d } = generate({ preset: id })
  if (!d) {
    console.error(`bake: preset "${id}" produced an empty path — skipping`)
    continue
  }
  const svg = generateSvg({ preset: id, fill: '#000' })
  const file = resolve(outDir, `metaball-${id}.svg`)
  await writeFile(file, svg + '\n', 'utf8')

  // The spec next to the shape, so a mark can be re-opened in the Studio.
  const spec = { preset: id, nodes: preset.nodes, edges: preset.edges, version: 1 }
  await writeFile(
    resolve(outDir, `metaball-${id}.json`),
    JSON.stringify(spec, null, 2) + '\n',
    'utf8',
  )
  written.push({ id, bytes: svg.length })
}

for (const { id, bytes } of written) console.log(`baked metaball-${id}.svg (${bytes} B)`)
console.log(`\n${written.length} marks → ${outDir}`)
