import assert from 'node:assert/strict';
import test from 'node:test';
import { AIRenderError } from '../lib/openai-image-render';
import { runReplicateEnhance } from '../lib/replicate-enhance';
import { normalizeAIEnhanceRequest, DEFAULT_AI_ENHANCE } from '../lib/ai-render-contract';
import { RenderJobStore } from '../lib/render-jobs';

const TINY_PNG = 'data:image/png;base64,aGVsbG8=';

test('enhance request normalization clamps and falls back', () => {
  assert.deepEqual(normalizeAIEnhanceRequest({ scaleFactor: 4, creativity: 1.7, resemblance: -1 }), {
    scaleFactor: 4,
    creativity: 1,
    resemblance: 0,
  });
  assert.deepEqual(normalizeAIEnhanceRequest({ scaleFactor: 3 }), { ...DEFAULT_AI_ENHANCE });
});

function providerFetch(sequence: { predictionPolls?: number; failCreate?: boolean }) {
  let polls = 0;
  const calls: string[] = [];
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (url.endsWith('/files')) {
      return new Response(JSON.stringify({ urls: { get: 'https://files.example/render' } }), {
        status: 201,
      });
    }
    if (url.includes('/models/') && !url.endsWith('/predictions')) {
      // community models resolve their latest version first
      return new Response(JSON.stringify({ latest_version: { id: 'ver-abc' } }), { status: 200 });
    }
    if (url.endsWith('/predictions')) {
      if (sequence.failCreate) {
        return new Response(JSON.stringify({ detail: 'Invalid version' }), { status: 422 });
      }
      const body = JSON.parse(String(init?.body));
      assert.equal(body.version, 'ver-abc');
      assert.equal(body.input.image, 'https://files.example/render');
      assert.equal(body.input.scale_factor, 2);
      return new Response(
        JSON.stringify({ id: 'p1', status: 'starting', urls: { get: 'https://api.example/p1' } }),
        { status: 201 },
      );
    }
    if (url === 'https://api.example/p1') {
      polls += 1;
      if (polls < (sequence.predictionPolls ?? 2)) {
        return new Response(JSON.stringify({ status: 'processing' }), { status: 200 });
      }
      return new Response(
        JSON.stringify({ status: 'succeeded', output: ['https://out.example/big.png'] }),
        { status: 200 },
      );
    }
    if (url === 'https://out.example/big.png') {
      return new Response(new Uint8Array([1, 2, 3]).buffer, {
        status: 200,
        headers: { 'content-type': 'image/png' },
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  return { fetchImpl, calls };
}

test('enhance adapter uploads, predicts, polls and materializes the output', async () => {
  const { fetchImpl, calls } = providerFetch({});
  const result = await runReplicateEnhance(
    { image: TINY_PNG, scaleFactor: 2, creativity: 0.35, resemblance: 0.6 },
    { apiToken: 'r8_test', fetchImpl, pollIntervalMs: 1 },
  );
  assert.match(result.image, /^data:image\/png;base64,/);
  assert.equal(result.scaleFactor, 2);
  assert.equal(calls[0], 'POST https://api.replicate.com/v1/files');
  assert.equal(calls[1], 'GET https://api.replicate.com/v1/models/philz1337x/clarity-upscaler');
  assert.equal(calls[2], 'POST https://api.replicate.com/v1/predictions');
});

test('enhance adapter fails closed: missing token, provider rejection', async () => {
  const previous = process.env.REPLICATE_API_TOKEN;
  delete process.env.REPLICATE_API_TOKEN;
  try {
    await assert.rejects(
      runReplicateEnhance({ image: TINY_PNG, scaleFactor: 2, creativity: 0.3, resemblance: 0.6 }),
      (error: unknown) => error instanceof AIRenderError && error.status === 503,
    );
  } finally {
    if (previous !== undefined) process.env.REPLICATE_API_TOKEN = previous;
  }
  const { fetchImpl } = providerFetch({ failCreate: true });
  await assert.rejects(
    runReplicateEnhance(
      { image: TINY_PNG, scaleFactor: 2, creativity: 0.3, resemblance: 0.6 },
      { apiToken: 'r8_test', fetchImpl, pollIntervalMs: 1 },
    ),
    (error: unknown) =>
      error instanceof AIRenderError && error.status === 400 && /Invalid version/.test(error.message),
  );
});

test('the generic job store runs the enhance runner and reports its failure label', async () => {
  const store = new RenderJobStore<{ n: number }, { doubled: number }>(
    async ({ n }) => ({ doubled: n * 2 }),
    Date.now,
    'Detail enhancement failed.',
  );
  const id = store.create({ n: 21 });
  await new Promise((resolve) => setTimeout(resolve, 10));
  const state = store.poll(id);
  assert.deepEqual(state, { status: 'done', result: { doubled: 42 } });
  // terminal read is single-delivery
  assert.equal(store.poll(id), null);
});
