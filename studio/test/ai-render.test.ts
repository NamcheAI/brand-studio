import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AI_METAMORPH_PARAM_KEYS,
  AI_RENDER_SIZES,
  DEFAULT_AI_METAMORPH_PARAMS,
  DEFAULT_AI_RENDER_PARAMS,
  GPT_IMAGE_MAX_EDGE,
  GPT_IMAGE_MAX_PIXELS,
  GPT_IMAGE_MIN_PIXELS,
  buildAIRenderPrompt,
  normalizeAIMetamorphParams,
  normalizeAIRenderParams,
} from '../lib/ai-render-contract';
import { runOpenAIMaterialSuggest } from '../lib/openai-material-suggest';
import { AIRenderError, runOpenAIImageRender } from '../lib/openai-image-render';

const TINY_PNG = 'data:image/png;base64,aGVsbG8=';
const TINY_JPEG = 'data:image/jpeg;base64,d29ybGQ=';

test('AI render parameters normalize untrusted input', () => {
  const params = normalizeAIRenderParams({
    materialDescription: '  soft   moss  ',
    geometryFidelity: 150,
    materialInfluence: -4,
    quality: 'impossible',
    size: '1536x1024',
    background: 'transparent',
  });

  assert.equal(params.materialDescription, 'soft moss');
  assert.equal(params.geometryFidelity, 100);
  assert.equal(params.materialInfluence, 0);
  assert.equal(params.quality, DEFAULT_AI_RENDER_PARAMS.quality);
  assert.equal(params.size, '1536x1024');
  assert.equal(params.background, 'transparent');
});

test('AI render prompt assigns stable roles to shape and material images', () => {
  const prompt = buildAIRenderPrompt(
    { ...DEFAULT_AI_RENDER_PARAMS, materialDescription: 'dense green moss' },
    true,
  );

  assert.match(prompt, /Image 1 is the canonical shape/);
  assert.match(prompt, /Image 2 is the material reference/);
  assert.match(prompt, /dense green moss/);
  assert.match(prompt, /Do not add or remove lobes, holes, limbs or separate objects/);
});

test('AI render adapter fails clearly when no server key is configured', async () => {
  await assert.rejects(
    runOpenAIImageRender(
      { shapeImage: TINY_PNG, params: DEFAULT_AI_RENDER_PARAMS },
      { apiKey: '' },
    ),
    (error: unknown) => error instanceof AIRenderError && error.status === 503,
  );
});

test('AI render adapter rejects a malformed body before calling the provider', async () => {
  await assert.rejects(
    runOpenAIImageRender(undefined as never, { apiKey: 'test-key' }),
    (error: unknown) => error instanceof AIRenderError && error.status === 400,
  );
});

test('AI render adapter sends shape first and optional material second', async () => {
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    assert.equal(String(input), 'https://api.openai.com/v1/images/edits');
    assert.equal(init?.method, 'POST');
    assert.deepEqual(init?.headers, { Authorization: 'Bearer test-key' });
    assert.ok(init?.body instanceof FormData);
    const form = init.body;
    assert.equal(form.get('model'), 'gpt-image-2.5-sunburst');
    assert.equal(form.get('quality'), 'medium');
    assert.equal(form.get('size'), '1024x1024');
    assert.equal(form.get('background'), 'opaque');
    assert.equal(form.get('output_format'), 'png');
    assert.equal(form.getAll('image[]').length, 2);
    assert.match(String(form.get('prompt')), /Image 2 is the material reference/);
    return new Response(JSON.stringify({ data: [{ b64_json: 'cmVuZGVy' }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'x-request-id': 'request-123' },
    });
  };

  const result = await runOpenAIImageRender(
    {
      shapeImage: TINY_PNG,
      materialImage: TINY_JPEG,
      params: DEFAULT_AI_RENDER_PARAMS,
    },
    { apiKey: 'test-key', fetchImpl },
  );

  assert.equal(result.image, 'data:image/png;base64,cmVuZGVy');
  assert.equal(result.model, 'gpt-image-2.5-sunburst');
  assert.equal(result.requestId, 'request-123');
});

test('metamorph params normalize and clamp; junk shapes drop to null', () => {
  const params = normalizeAIMetamorphParams({
    deformAmount: 150,
    nubDensity: -5,
    porosityAmount: 'sixty',
    poreSize: 2,
    heightVariation: 60.4,
  });
  assert.deepEqual(params, {
    deformAmount: 100,
    nubDensity: 0,
    porosityAmount: DEFAULT_AI_METAMORPH_PARAMS.porosityAmount,
    poreSize: 2,
    heightVariation: 60,
    // An older payload that predates the optics knobs still normalizes:
    // the missing keys take their defaults rather than becoming NaN.
    glossiness: DEFAULT_AI_METAMORPH_PARAMS.glossiness,
    translucency: DEFAULT_AI_METAMORPH_PARAMS.translucency,
    patternScale: DEFAULT_AI_METAMORPH_PARAMS.patternScale,
  });
  assert.equal(normalizeAIMetamorphParams(null), null);
  assert.equal(normalizeAIMetamorphParams('metamorph'), null);
});

test('metamorph template takes over when set with a material image, not without one', () => {
  const params = normalizeAIRenderParams({
    ...DEFAULT_AI_RENDER_PARAMS,
    metamorph: { deformAmount: 10, nubDensity: 33, porosityAmount: 100, poreSize: 2, heightVariation: 70 },
  });
  const withImage = buildAIRenderPrompt(params, true);
  assert.match(withImage, /surface deformation at 10% intensity/);
  assert.match(withImage, /characteristic surface forms outward at 33% density/);
  assert.match(withImage, /Thread 100% porosity/);
  assert.match(withImage, /with 2% openings/);
  assert.match(withImage, /relief at 70%/);
  assert.match(withImage, /MATERIAL IDENTITY/);
  assert.match(withImage, /No text, captions, watermark/);
  // the reference photo is a material sample, never a scene
  assert.match(withImage, /ignore its scene, objects, background, perspective and lighting/);
  assert.match(withImage, /camera angle, framing, scale and position of the object exactly as in the first image/);
  assert.match(withImage, new RegExp(DEFAULT_AI_RENDER_PARAMS.lightingDescription.slice(0, 30)));
  assert.match(withImage, new RegExp(DEFAULT_AI_RENDER_PARAMS.backgroundDescription.slice(0, 20)));
  assert.doesNotMatch(withImage, /background and lighting style from the second/);
  const transparent = buildAIRenderPrompt({ ...params, background: 'transparent' }, true);
  assert.match(transparent, /fully transparent background/);
  // without a material reference the standard prompt still applies
  const withoutImage = buildAIRenderPrompt(params, false);
  assert.match(withoutImage, /Image 1 is the canonical shape/);
  assert.doesNotMatch(withoutImage, /finger-like nubs/);
});

test('suggest adapter parses a Responses payload into clamped params', async () => {
  let requestedUrl = '';
  let requestBody: Record<string, unknown> = {};
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    requestedUrl = String(input);
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(
      JSON.stringify({
        output: [
          {
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({
                  deformAmount: 120,
                  nubDensity: 55,
                  porosityAmount: 90,
                  poreSize: 8,
                  heightVariation: 65,
                  materialDescription: '  Porous bleached coral with waxy sheen.  ',
                }),
              },
            ],
          },
        ],
      }),
      { status: 200 },
    );
  };

  const result = await runOpenAIMaterialSuggest(
    { materialImage: TINY_JPEG },
    { apiKey: 'test-key', fetchImpl },
  );
  assert.equal(requestedUrl, 'https://api.openai.com/v1/responses');
  assert.equal(result.params.deformAmount, 100);
  assert.equal(result.params.poreSize, 8);
  assert.equal(result.materialDescription, 'Porous bleached coral with waxy sheen.');
  const input = requestBody.input as Array<{ content: Array<{ type: string }> }>;
  assert.equal(input[0]!.content[1]!.type, 'input_image');
});

test('suggest adapter fails closed on unusable provider output and missing key', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ output: [] }), { status: 200 });
  await assert.rejects(
    runOpenAIMaterialSuggest({ materialImage: TINY_JPEG }, { apiKey: 'k', fetchImpl }),
    (error: unknown) => error instanceof AIRenderError && error.status === 502,
  );
  const previous = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    await assert.rejects(
      runOpenAIMaterialSuggest({ materialImage: TINY_JPEG }, {}),
      (error: unknown) => error instanceof AIRenderError && error.status === 503,
    );
  } finally {
    if (previous !== undefined) process.env.OPENAI_API_KEY = previous;
  }
});

test('every offered render size satisfies gpt-image-2 constraints', () => {
  for (const size of AI_RENDER_SIZES) {
    const [width, height] = size.split('x').map(Number) as [number, number];
    const pixels = width * height;
    const ratio = Math.max(width, height) / Math.min(width, height);
    assert.equal(width % 16, 0, `${size}: width must be divisible by 16`);
    assert.equal(height % 16, 0, `${size}: height must be divisible by 16`);
    assert.ok(Math.max(width, height) <= GPT_IMAGE_MAX_EDGE, `${size}: edge over ${GPT_IMAGE_MAX_EDGE}`);
    assert.ok(ratio <= 3, `${size}: aspect ratio over 3:1`);
    assert.ok(pixels >= GPT_IMAGE_MIN_PIXELS, `${size}: under the pixel floor`);
    assert.ok(pixels <= GPT_IMAGE_MAX_PIXELS, `${size}: over the pixel ceiling`);
  }
  // The high-res targets are actually reachable through normalization.
  assert.equal(normalizeAIRenderParams({ size: '2880x2880' }).size, '2880x2880');
  assert.equal(normalizeAIRenderParams({ size: '3840x2160' }).size, '3840x2160');
  // and an unsupported one still falls back rather than reaching the provider
  assert.equal(normalizeAIRenderParams({ size: '7680x4320' }).size, DEFAULT_AI_RENDER_PARAMS.size);
});

test('the optics knobs reach the template and separate look-alike structures', () => {
  const structure = {
    deformAmount: 5, nubDensity: 0, porosityAmount: 0, poreSize: 0, heightVariation: 10,
  };
  const wet = normalizeAIRenderParams({
    ...DEFAULT_AI_RENDER_PARAMS,
    metamorph: { ...structure, glossiness: 90, translucency: 0, patternScale: 30 },
  });
  const chalk = normalizeAIRenderParams({
    ...DEFAULT_AI_RENDER_PARAMS,
    metamorph: { ...structure, glossiness: 5, translucency: 70, patternScale: 95 },
  });
  const wetPrompt = buildAIRenderPrompt(wet, true);
  const chalkPrompt = buildAIRenderPrompt(chalk, true);

  assert.match(wetPrompt, /finish at 90% gloss/);
  assert.match(wetPrompt, /0% translucency/);
  assert.match(wetPrompt, /pattern to 30%/);
  assert.match(chalkPrompt, /finish at 5% gloss/);
  assert.match(chalkPrompt, /70% translucency/);
  assert.match(chalkPrompt, /pattern to 95%/);
  // Structurally identical inputs must still produce different prompts --
  // that difference is the whole point of the optics group.
  assert.notEqual(wetPrompt, chalkPrompt);
});

test('every metamorph key is clamped and surfaced in the suggest schema', () => {
  const wild = Object.fromEntries(AI_METAMORPH_PARAM_KEYS.map((key) => [key, 999]));
  const clamped = normalizeAIMetamorphParams(wild);
  for (const key of AI_METAMORPH_PARAM_KEYS) {
    assert.equal(clamped?.[key], 100, `${key} should clamp to 100`);
  }
});

test('the material identity replaces generic coral vocabulary in the template', () => {
  const noodles = normalizeAIRenderParams({
    ...DEFAULT_AI_RENDER_PARAMS,
    materialDescription: 'Golden cooked noodles, semi-matte, opaque.',
    structureDescription: 'looping strands of cooked noodle with hollow cut tube-ends',
    metamorph: { ...DEFAULT_AI_METAMORPH_PARAMS, nubDensity: 60 },
  });
  const prompt = buildAIRenderPrompt(noodles, true);
  assert.match(prompt, /looping strands of cooked noodle with hollow cut tube-ends/);
  assert.match(prompt, /Golden cooked noodles/);
  assert.match(prompt, /never as generic bumps or coral-like nubs/);
  // The old hardcoded vocabulary is gone — it made every material render coral-ish.
  assert.doesNotMatch(prompt, /finger-like nubs and tendrils/);
});

test('zero-valued knobs become negations instead of "0%" suggestions', () => {
  // A sentence that says "0% holes" still plants the idea of holes — the
  // blueberry sample rendered porous for exactly that reason.
  const solid = normalizeAIRenderParams({
    ...DEFAULT_AI_RENDER_PARAMS,
    metamorph: {
      ...DEFAULT_AI_METAMORPH_PARAMS,
      nubDensity: 0,
      porosityAmount: 0,
      poreSize: 0,
      heightVariation: 5,
    },
  });
  const prompt = buildAIRenderPrompt(solid, true);
  assert.match(prompt, /no holes, pores or cavities anywhere/);
  assert.match(prompt, /free of protrusions/);
  assert.match(prompt, /smooth and continuous, with soft flowing transitions/);
  assert.doesNotMatch(prompt, /Thread 0% porosity/);
  assert.doesNotMatch(prompt, /outward at 0% density/);
  // and the jellyfish case: smooth materials must not get the relief sentence
  assert.doesNotMatch(prompt, /peaks, ridges/);
});

test('high-res renders demand invented macro detail; small ones do not', () => {
  const base = normalizeAIRenderParams({
    ...DEFAULT_AI_RENDER_PARAMS,
    metamorph: DEFAULT_AI_METAMORPH_PARAMS,
  });
  const big = buildAIRenderPrompt({ ...base, size: '2880x2880' }, true);
  assert.match(big, /MACRO DETAIL/);
  assert.match(big, /renders at 2880x2880/);
  assert.match(big, /no two regions repeat/);
  assert.match(big, /Never smooth, blur, tile or upsample/);
  const small = buildAIRenderPrompt({ ...base, size: '1024x1024' }, true);
  assert.doesNotMatch(small, /MACRO DETAIL/);
  // the classic prompt gets the same treatment
  const classicBig = buildAIRenderPrompt(
    normalizeAIRenderParams({ ...DEFAULT_AI_RENDER_PARAMS, size: '3840x2160' }),
    false,
  );
  assert.match(classicBig, /MACRO DETAIL/);
});
