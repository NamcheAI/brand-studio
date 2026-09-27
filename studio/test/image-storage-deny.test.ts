import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { imageStorageDeny } from '../server/image-storage-deny';

test('Vite cannot serve private history through direct, raw or absolute file URLs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'image-vite-'));
  const custom = join(root, 'custom-history');
  await mkdir(custom);
  await mkdir(join(root, '.data'));
  for (const path of ['custom-history/study.json', '.data/study.json', '.env']) {
    await writeFile(join(root, path), 'private-history-fixture');
  }
  await writeFile(join(root, 'public.txt'), 'public fixture');
  const server = await createServer({
    configFile: false, root, logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, fs: { deny: imageStorageDeny(custom) } },
  });
  try {
    await server.listen();
    const address = server.httpServer!.address();
    assert(address && typeof address === 'object');
    const base = `http://127.0.0.1:${address.port}`;
    for (const path of ['/custom-history/study.json', '/custom-history/study.json?raw', '/.data/study.json', '/.env', `/@fs/${custom}/study.json`]) {
      const response = await fetch(base + path);
      assert.equal(response.status, 403, path);
      assert.doesNotMatch(await response.text(), /private-history-fixture/);
    }
    assert.equal(await fetch(base + '/public.txt').then(response => response.text()), 'public fixture');
  } finally { await server.close(); await rm(root, { recursive: true, force: true }); }
});
