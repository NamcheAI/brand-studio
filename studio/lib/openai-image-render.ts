import {
  buildAIRenderPrompt,
  normalizeAIRenderParams,
  type AIRenderRequest,
  type AIRenderResult,
} from './ai-render-contract.js';

const DEFAULT_MODEL = 'gpt-image-2.5-sunburst';
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;

export class AIRenderError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'AIRenderError';
    this.status = status;
  }
}

type ParsedImage = {
  bytes: Uint8Array;
  mime: string;
  extension: string;
};

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export type AIRenderProviderOptions = {
  apiKey?: string;
  model?: string;
  fetchImpl?: FetchLike;
};

export function parseImageDataUrl(value: unknown, label: string): ParsedImage {
  if (typeof value !== 'string') throw new AIRenderError(400, `${label} is required.`);
  const match = DATA_URL_PATTERN.exec(value);
  if (!match) throw new AIRenderError(400, `${label} must be a PNG, JPEG or WebP data URL.`);

  const mime = match[1] ?? 'image/png';
  const encoded = match[2] ?? '';
  const bytes = Uint8Array.from(Buffer.from(encoded, 'base64'));
  if (bytes.byteLength === 0) throw new AIRenderError(400, `${label} is empty.`);
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new AIRenderError(413, `${label} exceeds the 4 MB render-input limit.`);
  }

  return {
    bytes,
    mime,
    extension: mime === 'image/jpeg' ? 'jpg' : mime.slice('image/'.length),
  };
}

function upstreamMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return 'The image provider rejected the render.';
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== 'object') return 'The image provider rejected the render.';
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' && message.trim()
    ? message.trim().slice(0, 500)
    : 'The image provider rejected the render.';
}

export async function runOpenAIImageRender(
  request: AIRenderRequest,
  options: AIRenderProviderOptions = {},
): Promise<AIRenderResult> {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AIRenderError(
      503,
      'AI rendering is not configured. Set OPENAI_API_KEY on the Studio server.',
    );
  }

  if (!request || typeof request !== 'object') {
    throw new AIRenderError(400, 'Render request body is required.');
  }
  const input = request as Partial<AIRenderRequest>;
  const shape = parseImageDataUrl(input.shapeImage, 'Shape image');
  const material = input.materialImage
    ? parseImageDataUrl(input.materialImage, 'Material image')
    : null;
  const params = normalizeAIRenderParams(input.params);
  const prompt = buildAIRenderPrompt(params, material !== null);
  const model = options.model ?? process.env.OPENAI_IMAGE_MODEL ?? DEFAULT_MODEL;
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('quality', params.quality);
  form.append('size', params.size);
  form.append('background', params.background);
  form.append('output_format', 'png');
  form.append(
    'image[]',
    new Blob([asArrayBuffer(shape.bytes)], { type: shape.mime }),
    `shape.${shape.extension}`,
  );
  if (material) {
    form.append(
      'image[]',
      new Blob([asArrayBuffer(material.bytes)], { type: material.mime }),
      `material.${material.extension}`,
    );
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const requestId = response.headers.get('x-request-id') ?? undefined;
  const payload = (await response.json().catch(() => null)) as
    | { data?: Array<{ b64_json?: unknown }> }
    | null;

  if (!response.ok) {
    const status = response.status === 429 ? 429 : response.status === 400 ? 400 : 502;
    throw new AIRenderError(status, upstreamMessage(payload));
  }

  const imageBase64 = payload?.data?.[0]?.b64_json;
  if (typeof imageBase64 !== 'string' || !imageBase64) {
    throw new AIRenderError(502, 'The image provider returned no render output.');
  }

  return {
    image: `data:image/png;base64,${imageBase64}`,
    model,
    prompt,
    requestId,
  };
}
