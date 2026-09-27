import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, join } from 'node:path';
import type { ImageStudy } from './image-studio-contract.js';
import { AIRenderError } from './openai-image-render.js';

type StoredStudy = { owner: string; study: ImageStudy; referenceMime?: string };
const QUOTA = 1024 * 1024 * 1024;
export const JOB_RESERVATION = 37 * 1024 * 1024;
export class ImageStudyStore {
  readonly directory: string;
  private entries = new Map<string, StoredStudy>();
  private bytes = 0;
  readonly ready: Promise<void>;
  constructor(directory?: string) {
    this.directory = resolve(directory ?? process.env.IMAGE_STUDIO_DATA_DIR ?? '.data/image-studio');
    this.ready = this.initialize();
  }
  private async initialize() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    for (const file of await readdir(this.directory)) {
      const path = join(this.directory, file);
      this.bytes += (await stat(path)).size;
      if (!/^[a-f0-9-]{36}\.json$/.test(file)) continue;
      const record = JSON.parse(await readFile(path, 'utf8')) as StoredStudy;
      if (record.study.id !== file.slice(0, -5) || !/^[a-f0-9]{64}$/.test(record.owner)) continue;
      if (record.study.status === 'running') {
        record.study = { ...record.study, status: 'error', error: 'Generation was interrupted by a server restart. Start a new study to try again.' };
        await this.atomic(file, JSON.stringify(record));
      }
      this.entries.set(record.study.id, record);
    }
  }
  assertCapacity(reserved: number) {
    if (this.bytes + reserved + JOB_RESERVATION > QUOTA || this.entries.size >= 10_000) throw new AIRenderError(507, 'Image storage is full. Ask the Studio administrator to free space.');
  }
  async save(record: StoredStudy) {
    await this.atomic(`${record.study.id}.json`, JSON.stringify(record));
    this.entries.set(record.study.id, record);
  }
  async markFailure(record: StoredStudy) {
    // Polling must reach a terminal state even when the disk can no longer be written.
    this.entries.set(record.study.id, record);
    try { await this.save(record); } catch { /* Keep the in-memory failure and any saved media. */ }
  }
  get(id: string, owner: string) {
    const record = this.entries.get(id);
    return record?.owner === owner ? record : undefined;
  }
  list(owner: string, offset: number) {
    const all = [...this.entries.values()].filter((record) => record.owner === owner).map((record) => record.study).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    return { studies: all.slice(offset, offset + 30), hasMore: all.length > offset + 30 };
  }
  async media(id: string, kind: 'image' | 'reference') { return readFile(join(this.directory, `${id}.${kind}`)); }
  async saveMedia(id: string, kind: 'image' | 'reference', bytes: Uint8Array) { await this.atomic(`${id}.${kind}`, bytes); }
  private async atomic(name: string, content: string | Uint8Array) {
    const path = join(this.directory, name);
    const oldSize = await stat(path).then((info) => info.size, () => 0);
    const temp = `${path}.${randomUUID()}.tmp`;
    await writeFile(temp, content, { mode: 0o600 });
    await rename(temp, path);
    this.bytes += (typeof content === 'string' ? Buffer.byteLength(content) : content.byteLength) - oldSize;
  }
}
