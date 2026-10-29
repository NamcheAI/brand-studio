import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const sha = 'a'.repeat(40);
const digest = `sha256:${'b'.repeat(64)}`;
for (const scenario of ['current', 'superseded', 'bad-digest', 'bad-source', 'bad-response']) {
  test(`main image publication: ${scenario}`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'ui-publish-'));
    try {
      writeFileSync(join(dir, 'gh'), '#!/bin/sh\nprintf "%s\\n" "$CURRENT_SHA"\n', { mode: 0o755 });
      writeFileSync(join(dir, 'docker'), '#!/bin/sh\nprintf "%s\\n" "$@" > "$CALLS"\n', { mode: 0o755 });
      const result = spawnSync('bash', ['.github/scripts/publish-main-image.sh'], {
        env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, CALLS: join(dir, 'calls'),
          HEAD_SHA: scenario === 'bad-source' ? `${sha}\nextra` : sha,
          DIGEST: scenario === 'bad-digest' ? `${digest}\n; injected` : digest,
          CURRENT_SHA: scenario === 'bad-response' ? 'not-a-sha' : scenario === 'superseded' ? 'c'.repeat(40) : sha,
          GITHUB_REPOSITORY: 'NamcheAI/brand-studio' }, encoding: 'utf8',
      });
      assert.equal(result.status === 0, ['current', 'superseded'].includes(scenario), result.stderr);
      assert.equal(existsSync(join(dir, 'calls')), scenario === 'current');
      if (scenario === 'current') {
        assert.equal(readFileSync(join(dir, 'calls'), 'utf8'),
          `buildx\nimagetools\ncreate\n--prefer-index=false\n--tag\nghcr.io/namcheai/brand-studio:main\nghcr.io/namcheai/brand-studio@${digest}\n`);
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}
