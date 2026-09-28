import type { ServerResponse } from 'node:http';
import { AIRenderError } from '../lib/openai-image-render.js';
import { runOpenAIMaterialSuggest } from '../lib/openai-material-suggest.js';
import type { AISuggestRequest } from '../lib/ai-render-contract.js';

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

/**
 * Handles `POST /api/render/suggest`: the metamorph flow's first call. Like
 * `/api/render`, app.ts applies the per-client rate limit first — a
 * suggestion is a paid provider call and spends one render slot.
 */
export async function handleSuggestRequest(
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
    const result = await runOpenAIMaterialSuggest(body as AISuggestRequest);
    json(res, 200, result);
  } catch (error) {
    if (error instanceof AIRenderError) {
      json(res, error.status, { error: error.message });
      return;
    }
    console.error('AI material suggestion failed', error);
    json(res, 500, { error: 'AI material suggestion failed.' });
  }
}
