import { AIRenderError, parseImageDataUrl } from './openai-image-render.js';
import {
  AI_METAMORPH_PARAM_KEYS,
  normalizeAIMetamorphParams,
  type AISuggestRequest,
  type AISuggestResult,
} from './ai-render-contract.js';

/**
 * First call of the metamorph flow: a vision model looks at the selected
 * surface texture and proposes the five template parameters plus a material
 * direction. Shares the render route's rate limiter, so a suggestion spends
 * one render slot.
 */

const DEFAULT_MODEL = 'gpt-5-mini';

const INSTRUCTIONS = `You tune an image-editing prompt that transfers a material photo onto a 3D blob sculpture. Analyze the attached material photo and answer with parameters, each 0-100.

STRUCTURE — what the material does to the form:
- deformAmount: how strongly the blob's silhouette should warp to match the material's structure (0 = perfectly smooth material like glass or milk keeps the form; 100 = wildly irregular material like coral or torn foam should reshape the form).
- nubDensity: how many finger-like nubs/tendrils should bud from the surface (high for coral, sponge, moss tips; near 0 for smooth or flat materials).
- porosityAmount: how much of the structure should be threaded with holes (100 for foam, bone, honeycomb; 0 for solid materials).
- poreSize: typical hole size relative to the object (small pinholes ~2, large voids ~60).
- heightVariation: unevenness of surface relief (0 flat/polished, 100 deep ridges and peaks).

OPTICS — how the surface reads under light:
- glossiness: 0 fully matte (chalk, unglazed clay, moss), 50 satin, 100 wet or mirror-bright (glazed ceramic, vinyl, ice, liquid).
- translucency: 0 fully opaque (stone, bark, metal), 100 strongly light-transmitting with subsurface glow (wax, jade, milk, thin petals, skin in backlight).
- patternScale: how large the material's motif should read on the object. 5 = a few huge motifs spanning the whole form (large polka dots, big leaves), 50 = motif clearly readable several times across the form, 95 = fine dense grain (sand, fabric weave, fur).

CALIBRATION — anchor your numbers to these so the same value means the same thing across different materials:
- Milk / poured cream: deform 0, nubs 0, porosity 0, pore 0, height 5, gloss 85, translucency 70, pattern 15.
- Polished stone / pebble: deform 5, nubs 0, porosity 0, pore 0, height 10, gloss 60, translucency 5, pattern 30.
- Glossy polka-dot vinyl: deform 10, nubs 0, porosity 0, pore 0, height 5, gloss 90, translucency 0, pattern 30.
- Beeswax / candle wax: deform 20, nubs 5, porosity 5, pore 5, height 25, gloss 40, translucency 75, pattern 20.
- Dry sand: deform 15, nubs 0, porosity 10, pore 3, height 30, gloss 10, translucency 0, pattern 95.
- Conifer needles / moss: deform 35, nubs 80, porosity 10, pore 3, height 60, gloss 40, translucency 25, pattern 70.
- Honeycomb / bath foam: deform 30, nubs 10, porosity 100, pore 20, height 45, gloss 30, translucency 35, pattern 55.
- Coral / sea sponge: deform 75, nubs 85, porosity 85, pore 25, height 80, gloss 20, translucency 15, pattern 60.

Also write materialDescription: one vivid sentence naming the material family, palette, finish and translucency, usable as a standalone prompt line.

Also write structureDescription: one sentence naming what this material's protrusions and openings actually ARE, in the material's own vocabulary — the renderer builds surface growths as these exact forms, so precision here is what stops every material from rendering as generic coral. Examples: "looping strands of cooked noodle with hollow cut tube-ends" / "muscular octopus tentacle tips lined with pale round suckers" / "miniature conifer crowns and mossy ridges, like a forested mountainside in miniature" / "clusters of taut, dusted berries pressed together" / "smooth gelatinous lobes with no distinct sub-structures".`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [...AI_METAMORPH_PARAM_KEYS, 'materialDescription', 'structureDescription'],
  properties: {
    deformAmount: { type: 'integer', minimum: 0, maximum: 100 },
    nubDensity: { type: 'integer', minimum: 0, maximum: 100 },
    porosityAmount: { type: 'integer', minimum: 0, maximum: 100 },
    poreSize: { type: 'integer', minimum: 0, maximum: 100 },
    heightVariation: { type: 'integer', minimum: 0, maximum: 100 },
    glossiness: { type: 'integer', minimum: 0, maximum: 100 },
    translucency: { type: 'integer', minimum: 0, maximum: 100 },
    patternScale: { type: 'integer', minimum: 0, maximum: 100 },
    materialDescription: { type: 'string', maxLength: 600 },
    structureDescription: { type: 'string', maxLength: 600 },
  },
} as const;

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type AISuggestProviderOptions = {
  apiKey?: string;
  model?: string;
  fetchImpl?: FetchLike;
};

function extractOutputText(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const direct = (payload as { output_text?: unknown }).output_text;
  if (typeof direct === 'string' && direct) return direct;
  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) return null;
  for (const item of output) {
    const content = (item as { content?: unknown })?.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const text = (part as { text?: unknown })?.text;
      if (typeof text === 'string' && text) return text;
    }
  }
  return null;
}

export async function runOpenAIMaterialSuggest(
  request: AISuggestRequest,
  options: AISuggestProviderOptions = {},
): Promise<AISuggestResult> {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AIRenderError(
      503,
      'AI suggestions are not configured. Set OPENAI_API_KEY on the Studio server.',
    );
  }
  if (!request || typeof request !== 'object') {
    throw new AIRenderError(400, 'Suggest request body is required.');
  }
  // Validates type, size and non-emptiness; the data URL itself is what we forward.
  parseImageDataUrl((request as Partial<AISuggestRequest>).materialImage, 'Material image');
  const materialImage = (request as AISuggestRequest).materialImage;

  const model = options.model ?? process.env.OPENAI_SUGGEST_MODEL ?? DEFAULT_MODEL;
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      instructions: INSTRUCTIONS,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Propose metamorph parameters for this material photo.' },
            { type: 'input_image', image_url: materialImage },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'metamorph_suggestion',
          strict: true,
          schema: SCHEMA,
        },
      },
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: { message?: unknown } }
    | null;
  if (!response.ok) {
    const message =
      typeof payload?.error?.message === 'string' && payload.error.message.trim()
        ? payload.error.message.trim().slice(0, 500)
        : 'The suggestion provider rejected the request.';
    const status = response.status === 429 ? 429 : response.status === 400 ? 400 : 502;
    throw new AIRenderError(status, message);
  }

  const text = extractOutputText(payload);
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  const params = normalizeAIMetamorphParams(parsed);
  if (!params || !parsed || typeof parsed !== 'object') {
    throw new AIRenderError(502, 'The suggestion provider returned no usable parameters.');
  }
  const text_field = (key: string, fallback: string): string => {
    const value = (parsed as Record<string, unknown>)[key];
    return typeof value === 'string' && value.trim() ? value.trim().slice(0, 600) : fallback;
  };
  const materialDescription = text_field(
    'materialDescription',
    'Material derived from the attached reference photo.',
  );
  const structureDescription = text_field(
    'structureDescription',
    'organic growths and openings true to the reference material, at their natural scale',
  );

  return { params, materialDescription, structureDescription, model };
}
