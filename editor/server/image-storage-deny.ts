import { realpathSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

/** Setting fs.deny replaces Vite's defaults, so retain its secret-file rules
 * alongside the private history directory. This also covers ?raw and /@fs/. */
export function imageStorageDeny(directory?: string): string[] {
  const storage = resolve(directory ?? '.data/image-studio').replaceAll('\\', '/');
  let ancestor = storage;
  const suffix: string[] = [];
  while (true) {
    try { ancestor = realpathSync(ancestor); break; }
    catch {
      const parent = dirname(ancestor);
      if (parent === ancestor) break;
      suffix.unshift(basename(ancestor));
      ancestor = parent;
    }
  }
  const canonical = join(ancestor, ...suffix).replaceAll('\\', '/');
  return [
    '.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**',
    '**/.data/**', `${storage}/**`, `${canonical}/**`,
  ];
}
