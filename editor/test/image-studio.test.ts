import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createImageStudioHandler } from '../server/image-studio.js';
import { ImageStudyStore } from '../lib/image-study-store.js';
import { generateStudioImage, validateImageStudioRequest } from '../lib/image-studio-provider.js';
import { buildImageStudioPrompt, type ImageStudioRequest, type ImageStudy } from '../lib/image-studio-contract.js';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=';
const request: ImageStudioRequest = { variant: 'hestia-field', scene: 'Two people', style: 'Red light', size: '1024x1024', quality: 'medium' };
const successfulFetch: typeof fetch = async () => new Response(JSON.stringify({ data: [{ b64_json: png }] }), { status: 200 });
async function serve(dataDir: string, fetchImpl: typeof fetch = successfulFetch) {
  const handler = createImageStudioHandler({ dataDir, apiKey: 'test-only', fetchImpl });
  const server = createServer((req, res) => { void handler(req, res, new URL(req.url!, 'http://localhost').pathname); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert(address && typeof address === 'object');
  return { url: `http://127.0.0.1:${address.port}`, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}
async function complete(url: string, id: string, cookie: string) {
  for (let i = 0; i < 100; i++) {
    const study = await fetch(`${url}/api/images/jobs/${id}`, { headers: { cookie } }).then((response) => response.json()) as ImageStudy;
    if (study.status !== 'running') return study;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Study did not complete');
}
test('private history, generated media and reference survive restart; other browser cannot access them', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'image-studio-')); let server = await serve(dir);
  try {
    const response = await fetch(`${server.url}/api/images/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...request, referenceImage: `data:image/png;base64,${png}` }) });
    assert.equal(response.status, 202);
    const cookie = response.headers.get('set-cookie')!.split(';')[0]!;
    assert.match(response.headers.get('set-cookie')!, /HttpOnly; SameSite=Strict/);
    const pending = await response.json() as ImageStudy;
    assert.equal(pending.status, 'running');
    const done = await complete(server.url, pending.id, cookie); assert.equal(done.status, 'done');
    await server.close(); server = await serve(dir);
    const history = await fetch(`${server.url}/api/images`, { headers: { cookie } }).then((r) => r.json());
    assert.equal(history.studies[0].id, pending.id); assert.equal(history.hasMore, false);
    assert.equal((await fetch(`${server.url}${done.imageUrl}`, { headers: { cookie } })).status, 200);
    assert.equal((await fetch(`${server.url}${done.referenceUrl}`, { headers: { cookie } })).status, 200);
    for (const path of [`/api/images/jobs/${pending.id}`, done.imageUrl!, done.referenceUrl!]) assert.equal((await fetch(`${server.url}${path}`)).status, 404);
    const empty = await fetch(`${server.url}/api/images`).then((r) => r.json()); assert.deepEqual(empty.studies, []);
  } finally { await server.close(); await rm(dir, { recursive: true, force: true }); }
});
test('validates before spend and persists failed provider jobs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'image-studio-')); let calls = 0;
  const server = await serve(dir, async () => { calls++; throw new Error('private upstream secret'); });
  try {
    for (const invalid of [{ ...request, variant: '__proto__' }, { ...request, scene: '' }, { ...request, style: 'x'.repeat(6001) }, { ...request, size: 'auto' }, { ...request, quality: 'invalid' }, { ...request, referenceImage: 'data:image/png;base64,YWJj' }]) {
      const response = await fetch(`${server.url}/api/images/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(invalid) });
      assert.equal(response.status, 400);
    }
    assert.equal(calls, 0);
    const response = await fetch(`${server.url}/api/images/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
    const cookie = response.headers.get('set-cookie')!.split(';')[0]!;
    const study = await response.json() as ImageStudy;
    const failed = await complete(server.url, study.id, cookie);
    assert.equal(failed.status, 'error'); assert.doesNotMatch(failed.error!, /secret/); assert.equal(calls, 1);
    assert.throws(() => validateImageStudioRequest({ ...request, referenceImage: 'a'.repeat(5_600_001) }), /4 MB/);
  } finally { await server.close(); await rm(dir, { recursive: true, force: true }); }
});
test('startup marks running jobs interrupted without resubmission; quota blocks spend', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'image-studio-'));
  try {
    const owner = createHash('sha256').update('test').digest('hex');
    const store = new ImageStudyStore(dir); await store.ready;
    const study: ImageStudy = { ...request, id: randomUUID(), createdAt: new Date().toISOString(), status: 'running', prompt: buildImageStudioPrompt(request) };
    await store.save({ owner, study });
    const restarted = new ImageStudyStore(dir); await restarted.ready;
    assert.equal(restarted.get(study.id, owner)?.study.status, 'error');
    assert.match(restarted.get(study.id, owner)?.study.error ?? '', /interrupted/);
    assert.throws(() => restarted.assertCapacity(1024 * 1024 * 1024), /storage is full/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('provider uses generation JSON without image and multipart edits with reference', async () => {
  for (const reference of [false, true]) {
    await generateStudioImage({ ...request, ...(reference ? { referenceImage: `data:image/png;base64,${png}` } : {}) }, { apiKey: 'test-only', fetchImpl: async (url, init) => {
      assert.equal(url, `https://api.openai.com/v1/images/${reference ? 'edits' : 'generations'}`);
      assert.ok(init?.signal);
      if (reference) { assert.ok(init?.body instanceof FormData); assert.ok(init.body.get('image[]') instanceof Blob); }
      else { const body = JSON.parse(init?.body as string); assert.equal(body.model, 'gpt-image-2.5-sunburst'); assert.equal(body.n, 1); }
      return successfulFetch(url, init);
    } });
  }
});
test('pending jobs remain queryable and the ninth concurrent job is rejected before spend', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'image-studio-'));
  let release!: () => void; const gate = new Promise<void>((resolve) => { release = resolve; }); let calls = 0;
  const server = await serve(dir, async (url, init) => { calls++; await gate; return successfulFetch(url, init); });
  const jobs: Array<{ id: string; cookie: string }> = [];
  try {
    for (let i = 0; i < 8; i++) {
      const response = await fetch(`${server.url}/api/images/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
      assert.equal(response.status, 202);
      jobs.push({ id: (await response.json() as ImageStudy).id, cookie: response.headers.get('set-cookie')!.split(';')[0]! });
    }
    const ninth = await fetch(`${server.url}/api/images/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
    assert.equal(ninth.status, 429); assert.equal(calls, 8);
    const first = jobs[0]!;
    const pending = await fetch(`${server.url}/api/images/jobs/${first.id}`, { headers: { cookie: first.cookie } }).then((r) => r.json());
    assert.equal(pending.status, 'running');
    assert.equal((await fetch(`${server.url}/api/images/${first.id}/image`, { headers: { cookie: first.cookie } })).status, 404);
  } finally {
    release();
    await Promise.all(jobs.map((job) => complete(server.url, job.id, job.cookie)));
    await server.close(); await rm(dir, { recursive: true, force: true });
  }
});
test('rejects cross-site submissions and returns 405 with Allow for recognized routes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'image-studio-')); let calls = 0;
  const server = await serve(dir, async (url, init) => { calls++; return successfulFetch(url, init); });
  try {
    for (const extra of [{ origin: 'https://other.example' }, { origin: 'null' }, { 'sec-fetch-site': 'cross-site' }]) {
      const response = await fetch(`${server.url}/api/images/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(request) });
      assert.equal(response.status, 403);
    }
    assert.equal(calls, 0);
    for (const path of ['/api/images', `/api/images/jobs/${randomUUID()}`, `/api/images/${randomUUID()}/image`, `/api/images/${randomUUID()}/reference`]) {
      const response = await fetch(`${server.url}${path}`, { method: 'DELETE' });
      assert.equal(response.status, 405); assert.equal(response.headers.get('allow'), 'GET');
    }
    const wrong = await fetch(`${server.url}/api/images/jobs`);
    assert.equal(wrong.status, 405); assert.equal(wrong.headers.get('allow'), 'POST');
    const response = await fetch(`${server.url}/api/images/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json', origin: server.url }, body: JSON.stringify(request) });
    assert.equal(response.status, 202);
    const study = await response.json() as ImageStudy;
    assert.equal((await complete(server.url, study.id, response.headers.get('set-cookie')!.split(';')[0]!)).status, 'done');
    assert.equal(calls, 1);
  } finally { await server.close(); await rm(dir, { recursive: true, force: true }); }
});
test('metadata write failure terminates polling and retains generated image for download', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'image-studio-'));
  const originalSave = ImageStudyStore.prototype.save;
  t.mock.method(ImageStudyStore.prototype, 'save', async function (this: ImageStudyStore, record: Parameters<ImageStudyStore['save']>[0]) {
    if (record.study.status !== 'running') throw new Error('Simulated full disk');
    return originalSave.call(this, record);
  });
  const server = await serve(dir);
  try {
    const response = await fetch(`${server.url}/api/images/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
    assert.equal(response.status, 202);
    const cookie = response.headers.get('set-cookie')!.split(';')[0]!;
    const study = await response.json() as ImageStudy;
    const failed = await complete(server.url, study.id, cookie);
    assert.equal(failed.status, 'error'); assert.match(failed.error!, /history could not be saved/);
    assert.ok(failed.imageUrl);
    const image = await fetch(`${server.url}${failed.imageUrl}`, { headers: { cookie } });
    assert.equal(image.status, 200); assert.equal(Buffer.from(await image.arrayBuffer()).toString('base64'), png);
    const history = await fetch(`${server.url}/api/images`, { headers: { cookie } }).then((r) => r.json());
    assert.equal(history.studies[0].status, 'error');
  } finally { t.mock.restoreAll(); await server.close(); await rm(dir, { recursive: true, force: true }); }
});
