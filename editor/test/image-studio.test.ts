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
async function serve(dataDir: string, fetchImpl: typeof fetch = successfulFetch, extra: { replicateToken?: string; apiKey?: string } = {}) {
  const handler = createImageStudioHandler({ dataDir, apiKey: 'test-only', fetchImpl, ...extra });
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

test('drafts, assistant iterations and multiple generations preserve immutable prompt versions', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'asset-versions-'));
  let imageCalls = 0; let assistantCalls = 0;
  const server = await serve(dir, async (url, init) => {
    if (String(url).endsWith('/responses')) {
      assistantCalls++;
      const body = JSON.parse(init!.body as string);
      assert.equal(body.store, false);
      assert.equal(body.text.format.type, 'json_schema');
      assert.equal(JSON.parse(body.input).scenic, request.style);
      return new Response(JSON.stringify({ output_text: JSON.stringify({ content: 'Two people, tightly framed around a dark screen', explanation: 'Made the framing and focal point explicit.' }) }));
    }
    imageCalls++;
    return successfulFetch(url, init);
  });
  try {
    const first = await fetch(`${server.url}/api/images/drafts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
    assert.equal(first.status, 201);
    const cookie = first.headers.get('set-cookie')!.split(';')[0]!;
    const draft = await first.json() as ImageStudy;
    assert.equal(draft.status, 'draft'); assert.equal(imageCalls, 0);
    const post = (path: string, body: unknown, ownerCookie = cookie) => fetch(server.url + path, { method: 'POST', headers: { cookie: ownerCookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await post('/api/images/assist', { sourceId: draft.id, instruction: 'Closer' }, '')).status, 404);
    assert.equal(assistantCalls, 0);
    assert.equal((await post('/api/images/assist', { sourceId: draft.id, instruction: '' })).status, 400);
    const suggested = await post('/api/images/assist', { sourceId: draft.id, instruction: 'Tighter framing' }).then(response => response.json()) as ImageStudy;
    assert.equal(suggested.status, 'draft'); assert.equal(suggested.style, draft.style);
    assert.equal(suggested.parentId, draft.id); assert.equal(suggested.promptVersionId, suggested.id);
    assert.equal(suggested.assistant?.previousScene, draft.scene);
    assert.equal((await complete(server.url, draft.id, cookie)).scene, draft.scene);
    const a = await post('/api/images/repeat', { sourceId: suggested.id }).then(response => response.json()) as ImageStudy;
    const b = await post('/api/images/repeat', { sourceId: suggested.id }).then(response => response.json()) as ImageStudy;
    assert.equal((await complete(server.url, a.id, cookie)).status, 'done');
    assert.equal((await complete(server.url, b.id, cookie)).status, 'done');
    assert.equal(a.promptVersionId, suggested.id); assert.equal(b.promptVersionId, suggested.id);
    const page = await fetch(`${server.url}/api/images?version=${suggested.id}`, { headers: { cookie } }).then(r => r.json());
    assert.equal(page.studies.length, 3); assert.equal(imageCalls, 2); assert.equal(assistantCalls, 1);
    const drafts = await fetch(`${server.url}/api/images?status=draft&search=framed`, { headers: { cookie } }).then(r => r.json());
    assert.equal(drafts.studies.length, 1); assert.equal(drafts.studies[0].id, suggested.id);
  } finally { await server.close(); await rm(dir, { recursive: true, force: true }); }
});

test('3D snapshots, shape/material references and bundles survive restart and remain owner-private', async () => {
  const { DEFAULT_AI_RENDER_PARAMS, buildAIRenderPrompt } = await import('../lib/ai-render-contract.js');
  const { unzipSync, strFromU8 } = await import('fflate');
  const dir = await mkdtemp(join(tmpdir(), 'asset-object-'));
  const document = JSON.stringify({ version: 9, nodes: [], edges: [], textureSlug: null });
  const params = { ...DEFAULT_AI_RENDER_PARAMS, materialDescription: 'Warm polished basalt' };
  let calls = 0;
  let server = await serve(dir, async (url, init) => {
    calls++;
    assert.ok(init?.body instanceof FormData);
    assert.equal(init.body.getAll('image[]').length, 2);
    assert.equal(init.body.get('prompt'), buildAIRenderPrompt(params, true));
    return successfulFetch(url, init);
  });
  try {
    const response = await fetch(`${server.url}/api/images/drafts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'object', params, document, shapeImage: `data:image/png;base64,${png}`, materialImage: `data:image/png;base64,${png}` }) });
    assert.equal(response.status, 201);
    const cookie = response.headers.get('set-cookie')!.split(';')[0]!;
    const draft = await response.json() as ImageStudy;
    assert.equal(draft.object?.document, document); assert.equal(draft.variant, 'metaball'); assert.equal(calls, 0);
    const result = await fetch(`${server.url}/api/images/repeat`, { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceId: draft.id }) });
    assert.equal(result.status, 202);
    const pending = await result.json() as ImageStudy;
    const done = await complete(server.url, pending.id, cookie);
    assert.equal(done.status, 'done'); assert.equal(calls, 1);
    const bundle = await fetch(`${server.url}/api/images/${done.id}/bundle`, { headers: { cookie } });
    assert.equal(bundle.status, 200); assert.match(bundle.headers.get('content-disposition')!, /attachment/);
    const files = unzipSync(new Uint8Array(await bundle.arrayBuffer()));
    assert.equal(strFromU8(files['document.json']!), document);
    assert.equal(strFromU8(files['prompt.txt']!), buildAIRenderPrompt(params, true));
    assert.ok(files['image.png']); assert.ok(files['shape.png']); assert.ok(files['reference.png']);
    assert.equal(JSON.parse(strFromU8(files['asset.json']!)).owner, undefined);
    await server.close(); server = await serve(dir);
    assert.equal((await complete(server.url, done.id, cookie)).object?.params.materialDescription, params.materialDescription);
    for (const path of [done.object!.shapeUrl, done.referenceUrl!, `/api/images/${done.id}/bundle`]) {
      assert.equal((await fetch(server.url + path, { headers: { cookie } })).status, 200);
      assert.equal((await fetch(server.url + path)).status, 404);
    }
    const objectPage = await fetch(`${server.url}/api/images?studio=object&status=done`, { headers: { cookie } }).then(r => r.json());
    assert.equal(objectPage.studies.length, 1);
    const imagePage = await fetch(`${server.url}/api/images?studio=images`, { headers: { cookie } }).then(r => r.json());
    assert.equal(imagePage.studies.length, 0);
  } finally { await server.close(); await rm(dir, { recursive: true, force: true }); }
});

test('filters run before pagination and legacy image records remain browsable', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'asset-pages-'));
  const store = new ImageStudyStore(dir); await store.ready;
  const owner = 'a'.repeat(64);
  try {
    for (let i = 0; i < 65; i++) await store.save({ owner, study: { ...request, variant: i % 2 ? 'filter' : 'hestia-field', id: randomUUID(), createdAt: new Date(i * 1000).toISOString(), status: i % 2 ? 'draft' : 'done', prompt: 'legacy prompt', scene: `Motif ${i}` } });
    const page = store.list(owner, 0, { variant: 'hestia-field', status: 'done' });
    assert.equal(page.studies.length, 30); assert.equal(page.hasMore, true);
    const last = store.list(owner, 30, { variant: 'hestia-field', status: 'done' });
    assert.equal(last.studies.length, 3); assert.equal(last.hasMore, false);
    assert.ok(page.studies.every(study => !last.studies.some(other => study.id === other.id)));
    assert.equal(store.list('b'.repeat(64), 0).studies.length, 0);
    const restarted = new ImageStudyStore(dir); await restarted.ready;
    assert.equal(restarted.list(owner, 0, { search: 'Motif 64' }).studies[0]?.scene, 'Motif 64');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('enhancements retain source lineage and private downloadable output', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'asset-enhance-'));
  let upstream = 0;
  const server = await serve(dir, async (url, init) => {
    const path = String(url);
    if (path.includes('openai.com')) return successfulFetch(url, init);
    upstream++;
    if (path.endsWith('/files')) return new Response(JSON.stringify({ urls: { get: 'https://example.test/input.png' } }));
    if (path.includes('/models/')) return new Response(JSON.stringify({ latest_version: { id: 'mock-version' } }));
    if (path.endsWith('/predictions')) return new Response(JSON.stringify({ id: 'prediction', urls: { get: 'https://example.test/prediction' }, status: 'succeeded', output: 'https://example.test/output.png' }));
    assert.equal(path, 'https://example.test/output.png');
    return new Response(Buffer.from(png, 'base64'), { headers: { 'content-type': 'image/png' } });
  }, { replicateToken: 'mock-only' });
  try {
    const first = await fetch(`${server.url}/api/images/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
    const cookie = first.headers.get('set-cookie')!.split(';')[0]!;
    const source = await first.json() as ImageStudy;
    await complete(server.url, source.id, cookie);
    const post = (path: string, body: unknown, ownerCookie = cookie) => fetch(server.url + path, { method: 'POST', headers: { cookie: ownerCookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await post('/api/images/enhance', { sourceId: source.id }, '')).status, 404);
    assert.equal(upstream, 0);
    const enhanced = await post('/api/images/enhance', { sourceId: source.id, scaleFactor: 4, creativity: 0.3, resemblance: 0.7 }).then(r => r.json()) as ImageStudy;
    const done = await complete(server.url, enhanced.id, cookie);
    assert.equal(done.status, 'done'); assert.equal(upstream, 4);
    assert.equal(done.parentId, source.id); assert.equal(done.enhancement?.sourceId, source.id);
    assert.equal(done.enhancement?.scaleFactor, 4); assert.equal(done.prompt, source.prompt);
    assert.equal(done.imageMime, 'image/png');
    assert.equal((await complete(server.url, source.id, cookie)).enhancement, undefined);
    const repeated = await post('/api/images/repeat', { sourceId: done.id }).then(r => r.json()) as ImageStudy;
    assert.equal((await complete(server.url, repeated.id, cookie)).status, 'done'); assert.equal(upstream, 8);
  } finally { await server.close(); await rm(dir, { recursive: true, force: true }); }
});

test('plain prompt versions can be saved without provider credentials; malformed assistance remains a draft', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'asset-errors-'));
  let server = await serve(dir, async () => { throw new Error('must not spend'); }, { apiKey: '' });
  try {
    const response = await fetch(`${server.url}/api/images/drafts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
    assert.equal(response.status, 201);
    const cookie = response.headers.get('set-cookie')!.split(';')[0]!;
    const draft = await response.json() as ImageStudy;
    await server.close();
    server = await serve(dir, async () => new Response(JSON.stringify({ output_text: '{invalid' })));
    const response2 = await fetch(`${server.url}/api/images/assist`, { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceId: draft.id, instruction: 'Closer' }) });
    assert.equal(response2.status, 502);
    assert.equal((await complete(server.url, draft.id, cookie)).status, 'draft');
    const history = await fetch(`${server.url}/api/images`, { headers: { cookie } }).then(r => r.json());
    assert.equal(history.studies.length, 1);
  } finally { await server.close(); await rm(dir, { recursive: true, force: true }); }
});
