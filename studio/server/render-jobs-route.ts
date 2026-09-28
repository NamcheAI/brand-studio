import type { ServerResponse } from 'node:http';
import { AIRenderError } from '../lib/openai-image-render.js';
import { RENDER_JOB_ID_PATTERN, type RenderJobStore } from '../lib/render-jobs.js';

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

/**
 * `POST /api/render/jobs` submits a render and answers immediately with the
 * job id (app.ts rate-limits it like the sync route — creation is the paid
 * call). `GET /api/render/jobs/<id>` is the poll: cheap, unlimited, and the
 * terminal answer is delivered exactly once.
 */
export async function handleRenderJobsRequest(
  store: RenderJobStore<never, object>,
  res: ServerResponse,
  method: string | undefined,
  pathname: string,
  body: unknown,
  basePath = '/api/render/jobs',
): Promise<void> {
  if (pathname === basePath) {
    if (method !== 'POST') {
      res.setHeader('Allow', 'POST');
      json(res, 405, { error: 'Method not allowed.' });
      return;
    }
    try {
      const jobId = store.create(body as never);
      json(res, 202, { jobId });
    } catch (error) {
      if (error instanceof AIRenderError) {
        json(res, error.status, { error: error.message });
        return;
      }
      console.error('AI render job submit failed', error);
      json(res, 500, { error: 'AI material render failed.' });
    }
    return;
  }

  const id = pathname.slice(basePath.length + 1);
  if (method !== 'GET') {
    res.setHeader('Allow', 'GET');
    json(res, 405, { error: 'Method not allowed.' });
    return;
  }
  if (!RENDER_JOB_ID_PATTERN.test(id)) {
    json(res, 404, { error: 'Unknown render job.' });
    return;
  }
  const state = store.poll(id);
  if (!state) {
    json(res, 404, { error: 'Unknown or expired render job.' });
    return;
  }
  if (state.status === 'running') {
    json(res, 200, { status: 'running' });
    return;
  }
  if (state.status === 'error') {
    json(res, state.httpStatus, { error: state.error });
    return;
  }
  json(res, 200, { status: 'done', ...state.result });
}
