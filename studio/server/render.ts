import type { ServerResponse } from 'node:http';
import { AIRenderError, runOpenAIImageRender } from '../lib/openai-image-render.js';
import type { AIRenderRequest } from '../lib/ai-render-contract.js';

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

/**
 * Handles `POST /api/render`: parses the already-read JSON body, calls the
 * OpenAI provider adapter, and maps `AIRenderError` to its HTTP status.
 * `app.ts` calls this AFTER its own per-client rate limit
 * (`render-rate-limit.ts`) -- the editor is public, so that limiter is the
 * only thing standing between a request and a paid OpenAI call.
 */
export async function handleRenderRequest(
  res: ServerResponse,
  method: string | undefined,
  body: unknown,
): Promise<void> {
  if (method !== 'POST') {
    res.setHeader('Allow', 'POST');
    json(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    const result = await runOpenAIImageRender(body as AIRenderRequest);
    json(res, 200, result);
  } catch (error) {
    if (error instanceof AIRenderError) {
      json(res, error.status, { error: error.message });
      return;
    }
    console.error('AI material render failed', error);
    json(res, 500, { error: 'AI material render failed.' });
  }
}
