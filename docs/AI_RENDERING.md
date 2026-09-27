# AI material rendering

NAMCHE Brand Studio can turn the current 3D camera view into a high-fidelity
material study without attempting production surface synthesis in WebGL. It is
a small, explicit image-model pipeline rather than a browser shader preset.

## Pipeline

```text
current 3D canvas (Image 1: shape + camera)
                         + optional material reference (Image 2)
                         + generic intent parameters
                                      ↓
                         POST /api/render (no auth -- public)
                                      ↓
                         server-side provider adapter
                                      ↓
                         generated image preview + download
```

Image order is part of the contract. Image 1 is always the canonical object,
silhouette, topology, framing and camera. Image 2, when present, is only a
material, palette and microstructure reference. The prompt tells the model not
to copy the second image's object or composition.

The controls describe material intent rather than one material family:

- **Material direction** works for nacre, coral, moss, fur, grass, stone,
  chrome, fabric or an invented surface.
- **Shape fidelity** controls how strictly the source silhouette and topology
  are held.
- **Material influence** controls how strongly the reference or written
  direction changes visible surface character.
- **Lighting**, **background**, **quality** and **size** describe the resulting
  study independently of the material.

The result is a rendered image of one camera view. It does not modify the live
Three.js mesh, produce UV/PBR texture maps or guarantee a view-consistent 3D
asset. A future multi-view pipeline can reuse the same contract with several
shape captures and a provider capable of consistent view synthesis.

## Local setup

Copy `studio/.env.example` to `studio/.env.local` and add a project API key:

```dotenv
OPENAI_API_KEY=...
# Optional override; the default is gpt-image-2.5-sunburst.
OPENAI_IMAGE_MODEL=gpt-image-2.5-sunburst
```

Then start the normal Studio:

```bash
npm run dev
```

Open **3D → AI material render**, optionally attach a material image, and run a
render. Each click is a paid API request. The UI prevents concurrent clicks in
one panel, but account-level project budgets and spend limits remain the final
cost guardrail.

`OPENAI_API_KEY` must remain server-only. Do not prefix it with `VITE_`; Vite
variables with that prefix are intentionally shipped to the browser. Production
deployments set the same variable in the server runtime.

**`/api/render` has no authentication** -- the Studio is a public
deployment (see [`studio/README.md`](../studio/README.md)) and there is no PIN
gate in front of it any more. Anyone who can reach the deployment can call
this endpoint and spend the configured provider's credits. The self-hosted
server -- the only deployment target, now that the Vercel path is gone --
therefore rate limits it per client IP (`RENDER_MAX_PER_HOUR`, default
10/hour; honor `X-Forwarded-For` only with `TRUST_PROXY=1`) as a spending
brake, not authentication.

## Code boundaries

- `studio/lib/ai-render-contract.ts` owns provider-neutral parameters, input and
  result types, validation and prompt composition.
- `studio/lib/openai-image-render.ts` is the first server-only provider adapter.
- `studio/server/render.ts` handles `POST /api/render`, called from
  `studio/server/app.ts` after its per-client rate limit
  (`studio/server/render-rate-limit.ts`).
- `studio/vite.config.ts` exposes an equivalent endpoint during local development.
- `studio/src/lib/aiRender.ts` captures and prepares browser images, but never
  receives a provider credential.
- `studio/src/components/AIRenderPanel.tsx` owns transient controls and result
  preview. AI results are intentionally not persisted in the Studio document.

The public `@namche/metaball-react` renderer must not depend on these files or
on any paid provider SDK. Provider tests use an injected mock `fetch` and must
never make a live API request.

Provider reference: [OpenAI image generation guide](https://developers.openai.com/api/docs/guides/image-generation).
