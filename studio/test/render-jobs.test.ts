import assert from 'node:assert/strict';
import test from 'node:test';
import { AIRenderError } from '../lib/openai-image-render';
import { RENDER_JOB_ID_PATTERN, RenderJobStore } from '../lib/render-jobs';
import type { AIRenderRequest, AIRenderResult } from '../lib/ai-render-contract';

const REQUEST = { shapeImage: 'data:image/png;base64,aGVsbG8=', params: {} } as AIRenderRequest;
const RESULT: AIRenderResult = { image: 'data:image/png;base64,aQ==', model: 'm', prompt: 'p' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

test('a job runs, delivers its result exactly once, then disappears', async () => {
  const gate = deferred<AIRenderResult>();
  const store = new RenderJobStore(() => gate.promise);
  const id = store.create(REQUEST);
  assert.match(id, RENDER_JOB_ID_PATTERN);
  assert.deepEqual(store.poll(id), { status: 'running' });

  gate.resolve(RESULT);
  await tick();
  assert.deepEqual(store.poll(id), { status: 'done', result: RESULT });
  // Results are multi-MB payloads: single delivery, then gone.
  assert.equal(store.poll(id), null);
  assert.equal(store.size, 0);
});

test('a failed run maps AIRenderError status through and generic errors to 500', async () => {
  const store = new RenderJobStore(() => Promise.reject(new AIRenderError(429, 'slow down')));
  const id = store.create(REQUEST);
  await tick();
  assert.deepEqual(store.poll(id), { status: 'error', httpStatus: 429, error: 'slow down' });

  const generic = new RenderJobStore(() => Promise.reject(new Error('boom')));
  const gid = generic.create(REQUEST);
  await tick();
  assert.deepEqual(generic.poll(gid), {
    status: 'error',
    httpStatus: 500,
    error: 'AI material render failed.',
  });
});

test('jobs expire by TTL and the active-job cap fails closed', async () => {
  let now = 1_000;
  const gate = deferred<AIRenderResult>();
  const store = new RenderJobStore(() => gate.promise, () => now);
  const id = store.create(REQUEST);
  now += 11 * 60_000;
  assert.equal(store.poll(id), null);

  const full = new RenderJobStore(() => deferred<AIRenderResult>().promise);
  for (let i = 0; i < 8; i += 1) full.create(REQUEST);
  assert.throws(
    () => full.create(REQUEST),
    (error: unknown) => error instanceof AIRenderError && error.status === 429,
  );
});

test('an unknown or malformed id is a miss, not a crash', () => {
  const store = new RenderJobStore(() => deferred<AIRenderResult>().promise);
  assert.equal(store.poll('00000000-0000-0000-0000-000000000000'), null);
  assert.equal(RENDER_JOB_ID_PATTERN.test('../../../etc/passwd'), false);
  assert.equal(RENDER_JOB_ID_PATTERN.test(''), false);
});
