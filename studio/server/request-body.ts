import type { IncomingMessage } from 'node:http';

const MAX_BODY_BYTES = 12 * 1024 * 1024;

/** Reads the raw request body, JSON-decoding it when the content type says so. */
export async function readRequestBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.byteLength;
    if (size > MAX_BODY_BYTES) throw new Error('Request body too large');
    chunks.push(bytes);
  }
  if (chunks.length === 0) return undefined;
  const raw = Buffer.concat(chunks).toString('utf8');
  const contentType = req.headers['content-type'] ?? '';
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  return raw;
}
