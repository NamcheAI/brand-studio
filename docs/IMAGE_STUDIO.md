# Image Studio

`/studio/images` is the third Studio entry point alongside the 2D mark and
3D object editors. It is lazy-loaded and does not import Three.js. The three
editable art directions are **Hestia field**, **Filter**, and **Close-ups**.
Each has an independent scene and style draft. Add an optional PNG, JPEG or
WebP reference (up to 4 MB), choose output size and quality, then generate.

The pipeline combines scene, art direction and explicit reference-image roles.
It uses `gpt-image-2.5-sunburst` by default, sharing the existing server-only
`OPENAI_API_KEY` and optional `OPENAI_IMAGE_MODEL` configuration. Without a
reference it calls `/v1/images/generations`; with one it uses multipart
`/v1/images/edits`. See the [OpenAI image API guide](https://developers.openai.com/api/docs/guides/image-generation).

## History and privacy

The editor has no account system. A random HttpOnly, SameSite=Strict cookie
identifies this browser's library. The server stores only a hash of that token
and checks ownership for history, job status, generated images and references.
Clearing cookies loses access to that library; this is not cross-device account
sync. Images are not published as static files or listed in a shared gallery.

`POST /api/images/jobs` validates the input and returns a pending study (202).
The client polls `GET /api/images/jobs/:id`. `GET /api/images?offset=0` returns
30 metadata records and `hasMore`; media loads separately. Prompt, settings,
reference and output persist on disk using atomic writes. The library supports
download and loading a previous study's settings and reference. It records failed
jobs too. A server restart marks unfinished jobs interrupted without repeating
a paid request. Generation continues if the browser leaves the page.

The route shares production's per-client render spending limit. Eight jobs may
run at once, each has a five-minute provider timeout, and the disk store stops
accepting new jobs before its 1 GiB or 10,000-record limit. It reserves space
for active jobs. Storage capacity errors require operator attention; there is
no silent deletion of old images. Back up the volume as user data. The store
supports one active server process, consistent with the existing deploy model.

## Deployment

Local development uses `editor/.data/image-studio` (gitignored), or
`IMAGE_STUDIO_DATA_DIR`. The production image sets this to `/data/image-studio`
and prepares `/data` for its non-root user. **Mount a persistent Docker volume
at `/data` before enabling production use**, for example
`--mount type=volume,source=namche-metaball-data,target=/data`. An unmounted
container filesystem does not survive a container replacement.

The `NamcheAI/infra` deploy contract owns that mount for candidate and live
containers. History initializes lazily on its first API request; health checks
do not mutate the library while a deployment candidate runs alongside the old
container. Do not run two live image workers against the same directory.

Tests mock the image provider. They exercise input validation, both provider
paths, cookie isolation including media, persistence, interrupted jobs, storage
failure, concurrency and origin checks without spending API credits.

## Weave sources

The initial prompts were adapted from the user's existing workflows:

- [Hestia field and filter](https://app.weavy.ai/flow/xxpSMnBI0pRlitC08QBetC):
  scene + shared art direction, red chiaroscuro fields and diffuse silhouettes.
- [Close-ups](https://app.weavy.ai/flow/Jzx9tN6dHgasyBTjNlSuDE):
  tactile human gestures, tight photographic crops and analog grain.
- [Metaball 3D generation](https://app.weavy.ai/flow/MIHyI67laVVp6nNujHlZzV):
  shape image + material sample, material transformation, optional Meshy mesh
  reconstruction and Magnific enhancement.

The existing Metaball material prompt now emphasizes intrinsic, tactile material
and coherent surfaces around curved and recessed areas. Studio lighting and
geometry remain authoritative. Meshy reconstruction is not part of this change;
AI material studies remain images of the canonical browser geometry. Existing
Weave outputs are not imported into the new library automatically.
