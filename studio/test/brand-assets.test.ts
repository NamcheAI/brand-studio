import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

test('Studio ships the official Basalt mark and Rhododendron favicon', async () => {
  const [favicon, mark, html] = await Promise.all([
    readFile(new URL('../public/favicon.svg', import.meta.url), 'utf8'),
    readFile(new URL('../public/namche-mark.svg', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
  ]);

  assert.match(favicon, /fill="#E03847"/);
  assert.match(favicon, /fill="#FFFFFF"/);
  assert.match(mark, /fill="#2B2B28"/);
  assert.equal(
    sha256(favicon),
    '51c599484d3b09b9a24f5430e4a7a5c5b73a5035cc81d8ef745aa7eedbc7f4ab',
  );
  assert.equal(
    sha256(mark),
    'f2a41739f838a4ad5a5b9e851f6f3518d5a204393e2d3fa8502c1186a81cd29c',
  );
  assert.match(html, /href="\/favicon\.svg\?v=brand-assets-1\.0\.0"/);
});
