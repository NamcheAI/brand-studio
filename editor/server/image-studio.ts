import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildImageStudioPrompt, type ImageStudy } from '../lib/image-studio-contract.js';
import { generateStudioImage, validateImageStudioRequest, validateReference, type ImageStudioProviderOptions } from '../lib/image-studio-provider.js';
import { ImageStudyStore, JOB_RESERVATION } from '../lib/image-study-store.js';
import { AIRenderError } from '../lib/openai-image-render.js';

let activeJobs = 0;
const COOKIE = 'namche_image_history';
function json(res: ServerResponse, status: number, value: unknown) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); }
function ownerFor(req: IncomingMessage, res: ServerResponse) {
  let token = req.headers.cookie?.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    token = randomBytes(32).toString('hex');
    const secure = 'encrypted' in req.socket && req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https';
    res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/api/images; HttpOnly; SameSite=Strict; Max-Age=31536000${secure ? '; Secure' : ''}`);
  }
  return createHash('sha256').update(token).digest('hex');
}
function assertSameOrigin(req: IncomingMessage) {
  if (req.headers['sec-fetch-site'] === 'cross-site') throw new AIRenderError(403, 'Cross-site image requests are not allowed.');
  const origin = req.headers.origin;
  if (origin !== undefined) {
    let host: string;
    try { host = new URL(origin).host; } catch { throw new AIRenderError(403, 'Invalid request origin.'); }
    if (!host || host !== req.headers.host) throw new AIRenderError(403, 'Cross-site image requests are not allowed.');
  }
}
async function body(req: IncomingMessage) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new AIRenderError(415, 'Expected application/json.');
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk);
    if (size > 5_650_000) throw new AIRenderError(413, 'Image request is too large.');
    chunks.push(Buffer.from(chunk));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; } catch { throw new AIRenderError(400, 'Invalid JSON request.'); }
}
export function createImageStudioHandler(options: ImageStudioProviderOptions & { dataDir?: string } = {}) {
  const store = new ImageStudyStore(options.dataDir);
  // Attach a rejection handler immediately; requests still receive the storage error.
  void store.ready.catch(() => undefined);
  return async (req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    try {
      const match = /^\/api\/images\/(?:jobs\/([a-f0-9-]{36})|([a-f0-9-]{36})\/(image|reference))$/.exec(pathname);
      const allowedMethod = pathname === '/api/images/jobs' ? 'POST' : pathname === '/api/images' || match ? 'GET' : undefined;
      if (allowedMethod && req.method !== allowedMethod) {
        res.setHeader('Allow', allowedMethod);
        throw new AIRenderError(405, 'Method not allowed.');
      }
      if (req.method === 'POST') assertSameOrigin(req);
      await store.ready;
      const owner = ownerFor(req, res);
      if (req.method === 'GET' && pathname === '/api/images') {
        const offset = Number(new URL(req.url ?? '/', 'http://localhost').searchParams.get('offset') ?? 0);
        if (!Number.isSafeInteger(offset) || offset < 0) throw new AIRenderError(400, 'Invalid history offset.');
        json(res, 200, store.list(owner, offset)); return;
      }
      if (req.method === 'POST' && pathname === '/api/images/jobs') {
        const input = validateImageStudioRequest(await body(req));
        if (!(options.apiKey ?? process.env.OPENAI_API_KEY)) throw new AIRenderError(503, 'Image generation is not configured. Set OPENAI_API_KEY on the Studio server.');
        if (activeJobs >= 8) throw new AIRenderError(429, 'All image generation slots are busy. Try again shortly.');
        store.assertCapacity(activeJobs * JOB_RESERVATION);
        activeJobs++;
        try {
          const { referenceImage, ...params } = input;
          const id = randomUUID();
          const study: ImageStudy = { ...params, id, createdAt: new Date().toISOString(), status: 'running', prompt: buildImageStudioPrompt(input), ...(referenceImage ? { referenceUrl: `/api/images/${id}/reference` } : {}) };
          const reference = referenceImage ? validateReference(referenceImage) : undefined;
          if (reference) await store.saveMedia(id, 'reference', reference.bytes);
          const record = { owner, study, referenceMime: reference?.mime };
          await store.save(record);
          void (async () => {
            let completed: ImageStudy | undefined;
            try {
              const result = await generateStudioImage(input, options);
              await store.saveMedia(id, 'image', result.bytes);
              completed = { ...study, status: 'done', model: result.model, imageUrl: `/api/images/${id}/image` };
              await store.save({ ...record, study: completed });
            } catch (error) {
              await store.markFailure({ ...record, study: { ...(completed ?? study), status: 'error', error: completed ? 'The image was generated, but its history could not be saved. Download it before restarting the server.' : error instanceof AIRenderError ? error.message : 'Generation could not complete. Please start a new study.' } });
            } finally { activeJobs--; }
          })();
          json(res, 202, study);
        } catch (error) { activeJobs--; throw error; }
        return;
      }
      if (req.method === 'GET' && match) {
        const id = match[1] ?? match[2]!;
        const record = store.get(id, owner);
        if (!record) throw new AIRenderError(404, 'Image study not found.');
        if (match[1]) { json(res, 200, record.study); return; }
        const kind = match[3] as 'image' | 'reference';
        if (kind === 'image' ? !record.study.imageUrl : !record.study.referenceUrl) throw new AIRenderError(404, 'Image not found.');
        const bytes = await store.media(id, kind);
        res.writeHead(200, { 'Content-Type': kind === 'image' ? 'image/png' : record.referenceMime!, 'Content-Length': bytes.length, 'Cache-Control': 'private, no-store' }); res.end(bytes); return;
      }
      throw new AIRenderError(404, 'Image endpoint not found.');
    } catch (error) { json(res, error instanceof AIRenderError ? error.status : 500, { error: error instanceof AIRenderError ? error.message : 'Image storage is unavailable.' }); }
  };
}
