import { AIRenderError, parseImageDataUrl } from './openai-image-render.js';
import {
  normalizeAIEnhanceRequest,
  type AIEnhanceRequest,
  type AIEnhanceResult,
} from './ai-render-contract.js';

/**
 * Creative detail synthesis via Replicate (Clarity Upscaler by default):
 * the composed render is uploaded through Replicate's Files API (data URIs
 * are capped far below our image sizes), a model-scoped prediction is
 * created, and its status is polled until terminal. Runs inside an async
 * job, so the minutes this takes never meet a proxy timeout.
 */

const DEFAULT_MODEL = 'philz1337x/clarity-upscaler';
const API = 'https://api.replicate.com/v1';
const POLL_INTERVAL_MS = 3_000;
const MAX_WAIT_MS = 8 * 60_000;

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type EnhanceProviderOptions = {
  apiToken?: string;
  model?: string;
  fetchImpl?: FetchLike;
  pollIntervalMs?: number;
  maxWaitMs?: number;
};

function upstreamMessage(payload: unknown, fallback: string): string {
  const detail = (payload as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail.trim().slice(0, 500);
  const title = (payload as { title?: unknown } | null)?.title;
  if (typeof title === 'string' && title.trim()) return title.trim().slice(0, 500);
  return fallback;
}

function mapStatus(status: number): number {
  if (status === 401 || status === 403) return 503;
  if (status === 402) return 503;
  if (status === 422 || status === 400) return 400;
  if (status === 429) return 429;
  return 502;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runReplicateEnhance(
  request: AIEnhanceRequest,
  options: EnhanceProviderOptions = {},
): Promise<AIEnhanceResult> {
  const apiToken = options.apiToken ?? process.env.REPLICATE_API_TOKEN;
  if (!apiToken) {
    throw new AIRenderError(
      503,
      'Detail enhancement is not configured. Set REPLICATE_API_TOKEN on the Studio server.',
    );
  }
  if (!request || typeof request !== 'object') {
    throw new AIRenderError(400, 'Enhance request body is required.');
  }
  const image = parseImageDataUrl((request as Partial<AIEnhanceRequest>).image, 'Render image');
  const params = normalizeAIEnhanceRequest(request);
  const model = options.model ?? process.env.REPLICATE_ENHANCE_MODEL ?? DEFAULT_MODEL;
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers = { Authorization: `Bearer ${apiToken}` };

  // 1. Upload the input image (data URIs are capped at ~256 KB on Replicate).
  const upload = new FormData();
  const imageBuffer = new Uint8Array(image.bytes).buffer as ArrayBuffer;
  upload.append('content', new Blob([imageBuffer], { type: image.mime }), `render.${image.extension}`);
  const fileResponse = await fetchImpl(`${API}/files`, { method: 'POST', headers, body: upload });
  const filePayload = (await fileResponse.json().catch(() => null)) as {
    urls?: { get?: string };
  } | null;
  if (!fileResponse.ok || !filePayload?.urls?.get) {
    throw new AIRenderError(
      mapStatus(fileResponse.status),
      upstreamMessage(filePayload, 'The enhancement provider rejected the image upload.'),
    );
  }

  // 2. Resolve the model's latest version: the model-scoped predictions
  //    endpoint serves only official models, and Clarity is a community
  //    model — those need POST /v1/predictions with an explicit version.
  const modelResponse = await fetchImpl(`${API}/models/${model}`, { headers });
  const modelPayload = (await modelResponse.json().catch(() => null)) as {
    latest_version?: { id?: string };
  } | null;
  const version = modelPayload?.latest_version?.id;
  if (!modelResponse.ok || !version) {
    throw new AIRenderError(
      mapStatus(modelResponse.status),
      upstreamMessage(modelPayload, `The enhancement model "${model}" could not be resolved.`),
    );
  }

  // 3. Create the prediction.
  const createResponse = await fetchImpl(`${API}/predictions`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      version,
      input: {
        image: filePayload.urls.get,
        scale_factor: params.scaleFactor,
        creativity: params.creativity,
        resemblance: params.resemblance,
      },
    }),
  });
  const created = (await createResponse.json().catch(() => null)) as {
    id?: string;
    status?: string;
    urls?: { get?: string };
  } | null;
  if (!createResponse.ok || !created?.urls?.get) {
    throw new AIRenderError(
      mapStatus(createResponse.status),
      upstreamMessage(created, 'The enhancement provider rejected the prediction.'),
    );
  }

  // 4. Poll until terminal.
  const deadline = Date.now() + (options.maxWaitMs ?? MAX_WAIT_MS);
  let prediction = created as { status?: string; output?: unknown; error?: unknown };
  while (prediction.status === 'starting' || prediction.status === 'processing') {
    if (Date.now() > deadline) {
      throw new AIRenderError(502, 'Detail enhancement timed out at the provider.');
    }
    await sleep(options.pollIntervalMs ?? POLL_INTERVAL_MS);
    const pollResponse = await fetchImpl(created.urls.get, { headers });
    prediction = ((await pollResponse.json().catch(() => null)) ?? {}) as typeof prediction;
  }
  if (prediction.status !== 'succeeded') {
    const detail =
      typeof prediction.error === 'string' && prediction.error.trim()
        ? prediction.error.trim().slice(0, 500)
        : 'Detail enhancement failed at the provider.';
    throw new AIRenderError(502, detail);
  }

  // 5. Fetch the output (URL or first of an array; the URL expires, so it is
  //    materialized here and returned as a data URL like every render).
  const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (typeof output !== 'string' || !output) {
    throw new AIRenderError(502, 'The enhancement provider returned no output image.');
  }
  const outputResponse = await fetchImpl(output);
  if (!outputResponse.ok) {
    throw new AIRenderError(502, 'The enhanced image could not be downloaded.');
  }
  const bytes = new Uint8Array(await outputResponse.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  const mime = outputResponse.headers.get('content-type')?.split(';')[0] || 'image/png';
  return {
    image: `data:${mime};base64,${btoa(binary)}`,
    model,
    ...params,
  };
}
