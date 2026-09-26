import { AI_RENDER_QUALITIES, AI_RENDER_SIZES } from './ai-render-contract.js';
import { buildImageStudioPrompt, imageStyles, type ImageStudioRequest } from './image-studio-contract.js';
import { AIRenderError, parseImageDataUrl } from './openai-image-render.js';

export type ImageStudioProviderOptions = { apiKey?: string; model?: string; fetchImpl?: typeof fetch };
export function validateImageStudioRequest(value: unknown): ImageStudioRequest {
  if (!value || typeof value !== 'object') throw new AIRenderError(400, 'An image request is required.');
  const input = value as Record<string, unknown>;
  if (typeof input.variant !== 'string' || !Object.hasOwn(imageStyles, input.variant)) throw new AIRenderError(400, 'Unknown image variant.');
  for (const key of ['scene', 'style']) {
    if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > 6000) throw new AIRenderError(400, `${key} must contain 1–6000 characters.`);
  }
  if (!(AI_RENDER_SIZES as readonly unknown[]).includes(input.size) || !(AI_RENDER_QUALITIES as readonly unknown[]).includes(input.quality)) throw new AIRenderError(400, 'Unsupported image size or quality.');
  if (input.referenceImage !== undefined) validateReference(input.referenceImage);
  return { variant: input.variant as ImageStudioRequest['variant'], scene: (input.scene as string).trim(), style: (input.style as string).trim(), size: input.size as ImageStudioRequest['size'], quality: input.quality as ImageStudioRequest['quality'], ...(input.referenceImage === undefined ? {} : { referenceImage: input.referenceImage as string }) };
}

export function validateReference(value: unknown) {
  if (typeof value !== 'string' || value.length > 5_600_000) throw new AIRenderError(413, 'Reference image exceeds the 4 MB limit.');
  const parsed = parseImageDataUrl(value, 'Reference image');
  const encoded = value.slice(value.indexOf(',') + 1);
  const bytes = Buffer.from(parsed.bytes);
  const valid = bytes.toString('base64') === encoded && (
    parsed.mime === 'image/png' && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    parsed.mime === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ||
    parsed.mime === 'image/webp' && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
  );
  if (!valid) throw new AIRenderError(400, 'Reference image is malformed or its file type does not match.');
  return parsed;
}

export async function generateStudioImage(input: ImageStudioRequest, options: ImageStudioProviderOptions) {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AIRenderError(503, 'Image generation is not configured. Set OPENAI_API_KEY on the Studio server.');
  const model = options.model ?? process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-2.5-sunburst';
  const fields = { model, prompt: buildImageStudioPrompt(input), size: input.size, quality: input.quality, output_format: 'png', n: 1 };
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
  let body: string | FormData;
  if (input.referenceImage) {
    const ref = validateReference(input.referenceImage);
    body = new FormData();
    for (const [key, value] of Object.entries(fields)) body.append(key, String(value));
    const bytes = new Uint8Array(ref.bytes.length);
    bytes.set(ref.bytes);
    body.append('image[]', new Blob([bytes.buffer], { type: ref.mime }), `reference.${ref.extension}`);
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(fields);
  }
  const response = await (options.fetchImpl ?? fetch)(`https://api.openai.com/v1/images/${input.referenceImage ? 'edits' : 'generations'}`, { method: 'POST', headers, body, signal: AbortSignal.timeout(300_000) });
  if (!response.ok) throw new AIRenderError(response.status === 429 ? 429 : 502, response.status === 429 ? 'Image provider is busy. Please try again later.' : 'Image provider could not complete this study.');
  const payload = await response.json() as { data?: Array<{ b64_json?: string }> };
  const encoded = payload.data?.[0]?.b64_json;
  if (typeof encoded !== 'string' || !encoded || encoded.length > 45_000_000) throw new AIRenderError(502, 'Image provider returned an invalid output.');
  const bytes = Buffer.from(encoded, 'base64');
  if (!bytes.length || bytes.length > 32 * 1024 * 1024 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new AIRenderError(502, 'Image provider returned an invalid PNG.');
  return { bytes, model };
}
