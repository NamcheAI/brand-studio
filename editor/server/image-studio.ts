import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildImageStudioPrompt, type ImageStudy, type ImageVariant } from '../lib/image-studio-contract.js';
import { generateStudioImage, validateImageStudioRequest, validateReference, type ImageStudioProviderOptions } from '../lib/image-studio-provider.js';
import { ImageStudyStore, JOB_RESERVATION } from '../lib/image-study-store.js';
import { assistPrompt } from '../lib/prompt-assistant.js';
import { buildAIRenderPrompt, normalizeAIRenderParams, normalizeAIEnhanceRequest } from '../lib/ai-render-contract.js';
import { runReplicateEnhance } from '../lib/replicate-enhance.js';
import { zipSync, strToU8 } from 'fflate';
import { AIRenderError, runOpenAIImageRender } from '../lib/openai-image-render.js';

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
    if (size > 11_500_000) throw new AIRenderError(413, 'Image request is too large.');
    chunks.push(Buffer.from(chunk));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; } catch { throw new AIRenderError(400, 'Invalid JSON request.'); }
}
export function createImageStudioHandler(options: ImageStudioProviderOptions & { dataDir?: string; suggestModel?: string; replicateToken?: string } = {}) {
  const store = new ImageStudyStore(options.dataDir);
  // Attach a rejection handler immediately; requests still receive the storage error.
  void store.ready.catch(() => undefined);
  type Record = Parameters<typeof store.save>[0];
  const copyInputs = async (source: Record, study: ImageStudy) => {
    if (source.study.referenceUrl) {
      await store.saveMedia(study.id, 'reference', await store.media(source.study.id, 'reference'));
      study.referenceUrl = `/api/images/${study.id}/reference`;
    }
    if (source.study.object) {
      await store.saveMedia(study.id, 'shape', await store.media(source.study.id, 'shape'));
      study.object = { ...source.study.object, shapeUrl: `/api/images/${study.id}/shape` };
    }
  };
  const launch = (record: Record, input: Parameters<typeof generateStudioImage>[0], shapeImage?: string) => {
    void (async () => {
      let completed: ImageStudy | undefined;
      try {
        let result: { bytes: Uint8Array; model: string };
        let imageMime: ImageStudy['imageMime'] = 'image/png';
        if (record.study.enhancement) {
          const settings = record.study.enhancement;
          const source = store.get(settings.sourceId, record.owner);
          if (!source?.study.imageUrl) throw new AIRenderError(404, 'Enhancement source not found.');
          const image = `data:${source.study.imageMime ?? 'image/png'};base64,${(await store.media(source.study.id, 'image')).toString('base64')}`;
          const signal = AbortSignal.timeout(10 * 60_000);
          const enhanced = await runReplicateEnhance({ image, ...settings }, { apiToken: options.replicateToken, fetchImpl: (url, init) => (options.fetchImpl ?? fetch)(url, { ...init, signal }) });
          const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(enhanced.image);
          if (!match || match[2]!.length > 45_000_000) throw new AIRenderError(502, 'Invalid enhanced image.');
          const bytes = Buffer.from(match[2]!, 'base64');
          if (!bytes.length || bytes.length > 32 * 1024 * 1024) throw new AIRenderError(502, 'Enhanced image exceeds storage limits.');
          const valid = match[1] === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : match[1] === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
          if (!valid) throw new AIRenderError(502, 'Enhanced image has an invalid file type.');
          imageMime = match[1] as ImageStudy['imageMime'];
          result = { bytes, model: enhanced.model };
        } else if (record.study.object && shapeImage) {
          const rendered = await runOpenAIImageRender({ shapeImage, materialImage: input.referenceImage, params: record.study.object.params }, { ...options, fetchImpl: (url, init) => (options.fetchImpl ?? fetch)(url, { ...init, signal: AbortSignal.timeout(300_000) }) });
          const encoded = rendered.image.split(',')[1];
          const bytes = Buffer.from(encoded ?? '', 'base64');
          if (!rendered.image.startsWith('data:image/png;base64,') || bytes.length > 32 * 1024 * 1024 || !bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new AIRenderError(502, 'Image provider returned an invalid PNG.');
          result = { bytes, model: rendered.model };
        } else result = await generateStudioImage(input, options);
        await store.saveMedia(record.study.id, 'image', result.bytes);
        completed = { ...record.study, status: 'done', model: result.model, imageMime, imageUrl: `/api/images/${record.study.id}/image` };
        await store.save({ ...record, study: completed });
      } catch {
        await store.markFailure({ ...record, study: { ...(completed ?? record.study), status: 'error', error: completed ? 'The image was generated, but its history could not be saved. Download it before restarting the server.' : 'Generation could not complete. Your prompts and references are saved; try a new generation.' } });
      } finally { activeJobs--; }
    })();
  };
  const reserve = () => {
    if (activeJobs >= 8) throw new AIRenderError(429, 'All generation slots are busy. Try again shortly.');
    store.assertCapacity(activeJobs * JOB_RESERVATION);
    activeJobs++;
  };
  return async (req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    try {
      const match = /^\/api\/images\/(?:jobs\/([a-f0-9-]{36})|([a-f0-9-]{36})\/(image|reference|shape|bundle))$/.exec(pathname);
      const allowedMethod = ['/api/images/jobs', '/api/images/object-jobs', '/api/images/drafts', '/api/images/repeat', '/api/images/assist', '/api/images/enhance'].includes(pathname) ? 'POST' : pathname === '/api/images' || match ? 'GET' : undefined;
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
        const query = new URL(req.url ?? '/', 'http://localhost').searchParams;
        json(res, 200, store.list(owner, offset, { studio: query.get('studio') ?? undefined, variant: query.get('variant') ?? undefined, status: query.get('status') ?? undefined, search: query.get('search')?.slice(0, 200), version: query.get('version') ?? undefined })); return;
      }
      if (req.method === 'POST' && (pathname === '/api/images/assist' || pathname === '/api/images/repeat' || pathname === '/api/images/enhance')) {
        const raw = await body(req) as { sourceId?: string; instruction?: string };
        const source = store.get(raw?.sourceId ?? '', owner);
        if (!source) throw new AIRenderError(404, 'Source study not found.');
        const isAssist = pathname.endsWith('/assist');
        const isEnhance = pathname.endsWith('/enhance');
        if (isEnhance && !source.study.imageUrl) throw new AIRenderError(400, 'Generate an image before enhancing it.');
        if (isAssist && (typeof raw.instruction !== 'string' || !raw.instruction.trim() || raw.instruction.length > 2000)) throw new AIRenderError(400, 'Describe the change in 1–2000 characters.');
        if (isEnhance || (!isAssist && source.study.enhancement)) {
          if (!(options.replicateToken ?? process.env.REPLICATE_API_TOKEN)) throw new AIRenderError(503, 'Detail enhancement is not configured.');
        } else if (!(options.apiKey ?? process.env.OPENAI_API_KEY)) throw new AIRenderError(503, 'Generation is not configured on this server.');
        reserve();
        let launched = false;
        try {
          const { imageUrl: _image, model: _model, error: _error, ...original } = source.study;
          const study: ImageStudy = { ...original, schemaVersion: 2, id: randomUUID(), createdAt: new Date().toISOString(), status: isAssist ? 'draft' : 'running', parentId: source.study.id, promptVersionId: source.study.promptVersionId ?? source.study.id };
          if (isEnhance) study.enhancement = { sourceId: source.study.id, ...normalizeAIEnhanceRequest(raw) };
          if (isAssist) delete study.enhancement;
          await copyInputs(source, study);
          if (isAssist) {
            const suggestion = await assistPrompt(source.study, raw.instruction!, options);
            study.scene = suggestion.content;
            study.assistant = { instruction: raw.instruction!, previousScene: source.study.scene, explanation: suggestion.explanation, model: suggestion.model };
            study.promptVersionId = study.id;
            if (study.object) study.object.params = { ...study.object.params, materialDescription: study.scene };
            study.prompt = study.object ? buildAIRenderPrompt(study.object.params, Boolean(study.referenceUrl)) : buildImageStudioPrompt({ ...study, variant: study.variant as ImageVariant, referenceImage: study.referenceUrl });
          }
          const record = { ...source, study };
          await store.save(record);
          if (!isAssist) {
            const referenceImage = study.referenceUrl ? `data:${record.referenceMime};base64,${(await store.media(study.id, 'reference')).toString('base64')}` : undefined;
            const shapeImage = study.object ? `data:${record.shapeMime};base64,${(await store.media(study.id, 'shape')).toString('base64')}` : undefined;
            launch(record, { ...study, variant: study.variant as ImageVariant, referenceImage }, shapeImage);
            launched = true;
          }
          json(res, isAssist ? 201 : 202, study);
        } finally { if (!launched) activeJobs--; }
        return;
      }
      if (req.method === 'POST' && ['/api/images/jobs', '/api/images/object-jobs', '/api/images/drafts'].includes(pathname)) {
        const raw = await body(req) as { kind?: string; params?: unknown; document?: unknown; shapeImage?: unknown; materialImage?: unknown; parentId?: unknown };
        if (!raw || typeof raw !== 'object') throw new AIRenderError(400, 'A study request is required.');
        const isObject = pathname === '/api/images/object-jobs' || raw?.kind === 'object';
        const isDraft = pathname === '/api/images/drafts';
        let shape: ReturnType<typeof validateReference> | undefined;
        let object: ImageStudy['object'];
        let input: Parameters<typeof generateStudioImage>[0];
        const id = randomUUID();
        if (isObject) {
          if (typeof raw.document !== 'string' || raw.document.length > 200_000) throw new AIRenderError(400, 'A bounded Studio document is required.');
          try {
            const doc = JSON.parse(raw.document);
            if (!doc || typeof doc !== 'object' || !Number.isInteger(doc.version)) throw new Error();
          } catch { throw new AIRenderError(400, 'Invalid Studio document.'); }
          shape = validateReference(raw.shapeImage);
          const params = normalizeAIRenderParams(raw.params);
          object = { params, document: raw.document, shapeUrl: `/api/images/${id}/shape` };
          input = { variant: 'hestia-field', scene: params.materialDescription, style: `LIGHTING\n${params.lightingDescription}\n\nBACKGROUND\n${params.backgroundDescription}`, size: params.size, quality: params.quality, ...(raw.materialImage ? { referenceImage: raw.materialImage as string } : {}) };
          if (input.referenceImage) validateReference(input.referenceImage);
        } else input = validateImageStudioRequest(raw);
        const parent = raw.parentId ? store.get(String(raw.parentId), owner) : undefined;
        if (raw.parentId && !parent) throw new AIRenderError(404, 'Parent study not found.');
        if (!isDraft && !(options.apiKey ?? process.env.OPENAI_API_KEY)) throw new AIRenderError(503, 'Image generation is not configured. Set OPENAI_API_KEY on the Studio server.');
        reserve();
        let launched = false;
        try {
          const { referenceImage, ...params } = input;
          const study: ImageStudy = { ...params, variant: object ? 'metaball' : params.variant, schemaVersion: 2, id, createdAt: new Date().toISOString(), status: isDraft ? 'draft' : 'running', prompt: object ? buildAIRenderPrompt(object.params, Boolean(referenceImage)) : buildImageStudioPrompt(input), ...(object ? { object } : {}), ...(parent ? { parentId: parent.study.id } : {}), promptVersionId: id, ...(referenceImage ? { referenceUrl: `/api/images/${id}/reference` } : {}) };
          // A changed setting or reference starts a new version; repeat keeps the original version.
          const reference = referenceImage ? validateReference(referenceImage) : undefined;
          if (reference) await store.saveMedia(id, 'reference', reference.bytes);
          if (shape) await store.saveMedia(id, 'shape', shape.bytes);
          const record = { owner, study, referenceMime: reference?.mime, shapeMime: shape?.mime };
          await store.save(record);
          if (!isDraft) { launch(record, input, isObject ? raw.shapeImage as string : undefined); launched = true; }
          json(res, isDraft ? 201 : 202, study);
        } finally { if (!launched) activeJobs--; }
        return;
      }
      if (req.method === 'GET' && match) {
        const id = match[1] ?? match[2]!;
        const record = store.get(id, owner);
        if (!record) throw new AIRenderError(404, 'Image study not found.');
        if (match[1]) { json(res, 200, record.study); return; }
        if (match[3] === 'bundle') {
          const files: { [name: string]: Uint8Array } = {
            'asset.json': strToU8(JSON.stringify(record.study, null, 2)),
            'prompt.txt': strToU8(record.study.prompt),
            'content-prompt.txt': strToU8(record.study.scene),
            'scenic-prompt.txt': strToU8(record.study.style),
          };
          if (record.study.imageUrl) files[`image.${record.study.imageMime === 'image/jpeg' ? 'jpg' : record.study.imageMime === 'image/webp' ? 'webp' : 'png'}`] = await store.media(id, 'image');
          if (record.study.referenceUrl) files[`reference.${record.referenceMime === 'image/jpeg' ? 'jpg' : record.referenceMime === 'image/webp' ? 'webp' : 'png'}`] = await store.media(id, 'reference');
          if (record.study.enhancement) {
            const source = store.get(record.study.enhancement.sourceId, owner);
            if (!source) throw new AIRenderError(404, 'Enhancement source not found.');
            files[`enhancement-input.${source.study.imageMime === 'image/jpeg' ? 'jpg' : source.study.imageMime === 'image/webp' ? 'webp' : 'png'}`] = await store.media(source.study.id, 'image');
            files['enhancement-source.json'] = strToU8(JSON.stringify(source.study, null, 2));
          }
          if (record.study.object) {
            files['document.json'] = strToU8(record.study.object.document);
            files[`shape.${record.shapeMime === 'image/jpeg' ? 'jpg' : 'png'}`] = await store.media(id, 'shape');
          }
          const bytes = zipSync(files, { level: 0 });
          res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="namche-asset-${id}.zip"`, 'Content-Length': bytes.length }); res.end(bytes); return;
        }
        const kind = match[3] as 'image' | 'reference' | 'shape';
        if (kind === 'image' ? !record.study.imageUrl : kind === 'shape' ? !record.study.object : !record.study.referenceUrl) throw new AIRenderError(404, 'Image not found.');
        const bytes = await store.media(id, kind);
        res.writeHead(200, { 'Content-Type': kind === 'image' ? (record.study.imageMime ?? 'image/png') : kind === 'shape' ? record.shapeMime! : record.referenceMime!, 'Content-Length': bytes.length, 'Cache-Control': 'private, no-store' }); res.end(bytes); return;
      }
      throw new AIRenderError(404, 'Image endpoint not found.');
    } catch (error) { json(res, error instanceof AIRenderError ? error.status : 500, { error: error instanceof AIRenderError ? error.message : 'Image storage is unavailable.' }); }
  };
}
