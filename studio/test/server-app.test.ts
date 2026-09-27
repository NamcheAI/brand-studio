import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer, type Server } from 'node:http';
import { createRequestListener } from '../server/app';

function makeDistDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'metaball-server-test-'));
  mkdirSync(path.join(dir, 'assets'));
  writeFileSync(path.join(dir, 'index.html'), '<html>app shell</html>');
  writeFileSync(path.join(dir, 'assets', 'app.js'), 'console.log(1)');
  return dir;
}

function addressOf(server: Server): string {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('expected a TCP address');
  return `http://127.0.0.1:${address.port}`;
}

async function withServer(
  distDir: string,
  run: (base: string) => Promise<void>,
): Promise<void> {
  const server = createServer(createRequestListener({ distDir }));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  try {
    await run(addressOf(server));
  } finally {
    // Force-close keep-alive sockets so `server.close()` resolves right
    // away instead of waiting out fetch's keep-alive idle timeout.
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test('the health check always returns ok', async () => {
  await withServer(makeDistDir(), async (base) => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
  });
});

test('the editor is public: every route is reachable with no authentication', async () => {
  await withServer(makeDistDir(), async (base) => {
    const root = await fetch(`${base}/`, { redirect: 'manual' });
    assert.equal(root.status, 200);
    assert.equal(await root.text(), '<html>app shell</html>');

    // /studio is the editor's own route; the SPA fallback has to serve the shell.
    const nested = await fetch(`${base}/studio`, { redirect: 'manual' });
    assert.equal(nested.status, 200);
    assert.equal(await nested.text(), '<html>app shell</html>');
  });
});

test('the render endpoint is rate limited per client', async (t) => {
  const saved = process.env.RENDER_MAX_PER_HOUR;
  process.env.RENDER_MAX_PER_HOUR = '1';
  t.after(() => {
    if (saved === undefined) delete process.env.RENDER_MAX_PER_HOUR;
    else process.env.RENDER_MAX_PER_HOUR = saved;
  });
  await withServer(makeDistDir(), async (base) => {
    // No OPENAI_API_KEY in tests, so the first request reaches the handler
    // (its not-configured error) and the second is cut off by the limiter.
    const first = await fetch(`${base}/api/render`, { method: 'POST', body: '{}' });
    assert.notEqual(first.status, 429);
    const second = await fetch(`${base}/api/render`, { method: 'POST', body: '{}' });
    assert.equal(second.status, 429);
    assert.ok(Number(second.headers.get('retry-after')) > 0);
  });
});

test('hashed assets are cached immutably, the app shell is never cached', async () => {
  await withServer(makeDistDir(), async (base) => {
    const asset = await fetch(`${base}/assets/app.js`);
    assert.equal(asset.headers.get('cache-control'), 'public, max-age=31536000, immutable');

    const index = await fetch(`${base}/`);
    assert.equal(index.headers.get('cache-control'), 'no-store');
  });
});

test('a missing asset-like path 404s instead of falling back to the app shell', async () => {
  await withServer(makeDistDir(), async (base) => {
    const res = await fetch(`${base}/missing.js`);
    assert.equal(res.status, 404);
  });
});

test('the /assets/ subtree never falls back to the app shell', async () => {
  await withServer(makeDistDir(), async (base) => {
    const res = await fetch(`${base}/assets/missing.css`, { redirect: 'manual' });
    assert.equal(res.status, 404);

    const extensionless = await fetch(`${base}/assets/anything`, { redirect: 'manual' });
    assert.equal(extensionless.status, 404);
  });
});

test('an unknown client-side route falls back to the app shell (SPA routing)', async () => {
  await withServer(makeDistDir(), async (base) => {
    const res = await fetch(`${base}/studio/anything`);
    assert.equal(res.status, 200);
    assert.equal(await res.text(), '<html>app shell</html>');
  });
});
