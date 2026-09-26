import type { IncomingMessage, ServerResponse } from 'node:http';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleRenderRequest } from './render.js';
import { handleSuggestRequest } from './suggest.js';
import { handleRenderJobsRequest } from './render-jobs-route.js';
import { RenderJobStore } from '../lib/render-jobs.js';
import { runReplicateEnhance } from '../lib/replicate-enhance.js';
import type { AIEnhanceRequest, AIEnhanceResult } from '../lib/ai-render-contract.js';
import {
  createRenderRateLimiter,
  renderRateLimitBudget,
  renderRateLimitKey,
  renderRateLimitTrustProxy,
} from './render-rate-limit.js';
import { readRequestBody } from './request-body.js';
import { serveStatic } from './static.js';
import { createImageStudioHandler } from './image-studio.js';

// Compiled to dist-server/server/app.js; editor/dist/ (the Vite build) is a
// sibling of dist-server/ one level up from there.
const DEFAULT_DIST_DIR = fileURLToPath(new URL('../../dist', import.meta.url));

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export type AppOptions = { distDir?: string };

export type RequestListener = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

/**
 * Builds the server's request pipeline: the health check first, then the
 * render API route (rate limited per client, then handled by
 * `render.ts`), then the static file server as the catch-all.
 */
export function createRequestListener(options: AppOptions = {}): RequestListener {
  const distDir = options.distDir ?? DEFAULT_DIST_DIR;
  // Spending guard, not authentication: the editor is public, but a render
  // is a paid provider call whenever OPENAI_API_KEY is configured.
  const renderLimiter = createRenderRateLimiter(renderRateLimitBudget());
  const trustProxy = renderRateLimitTrustProxy();
  const renderJobs = new RenderJobStore();
  let imageStudio: ReturnType<typeof createImageStudioHandler> | undefined;
  const enhanceJobs = new RenderJobStore<AIEnhanceRequest, AIEnhanceResult>(
    runReplicateEnhance,
    Date.now,
    'Detail enhancement failed.',
  );

  return async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      // Canonicalize ONCE, before any routing decision: the API routes and
      // the static server must both judge the same string. Deciding on the
      // encoded path and decoding later would let `/assets/%2E%2E/index.html`
      // normalize into a path outside the intended static root.
      const rawPathname = new URL(req.url ?? '/', 'http://internal.invalid').pathname;
      let decodedPathname: string;
      try {
        decodedPathname = decodeURIComponent(rawPathname);
      } catch {
        res.statusCode = 400;
        res.end();
        return;
      }
      // Reject dot-dot segments before normalize would resolve them away.
      if (decodedPathname.split('/').some((segment) => segment === '..' || segment === '.')) {
        res.statusCode = 400;
        res.end();
        return;
      }
      const pathname = posix.normalize(decodedPathname);

      if (pathname === '/api/health' && (req.method === 'GET' || req.method === 'HEAD')) {
        sendJson(res, 200, { ok: true });
        return;
      }

      if (pathname === '/api/images' || pathname.startsWith('/api/images/')) {
        if (pathname === '/api/images/jobs' && req.method === 'POST') {
          const verdict = renderLimiter.take(renderRateLimitKey(req, trustProxy));
          if (!verdict.allowed) {
            res.setHeader('Retry-After', String(verdict.retryAfterSeconds));
            sendJson(res, 429, { error: 'Render rate limit reached. Try again later.' });
            return;
          }
        }
        imageStudio ??= createImageStudioHandler();
        await imageStudio(req, res, pathname);
        return;
      }

      // Method validation (POST-only for render) lives in the handler
      // itself -- routing here only matches the path so that behavior
      // isn't duplicated.
      if (pathname === '/api/render/jobs' || pathname.startsWith('/api/render/jobs/')) {
        // Submitting is the paid call and shares the render budget; polling
        // is a cheap in-memory read and stays unlimited.
        if (pathname === '/api/render/jobs' && req.method === 'POST') {
          const verdict = renderLimiter.take(renderRateLimitKey(req, trustProxy));
          if (!verdict.allowed) {
            res.setHeader('Retry-After', String(verdict.retryAfterSeconds));
            sendJson(res, 429, { error: 'Render rate limit reached. Try again later.' });
            return;
          }
        }
        const body = req.method === 'POST' ? await readRequestBody(req) : undefined;
        await handleRenderJobsRequest(renderJobs, res, req.method, pathname, body);
        return;
      }

      // The enhance stage: same async-job shape, a different paid provider.
      if (pathname === '/api/enhance/jobs' || pathname.startsWith('/api/enhance/jobs/')) {
        if (pathname === '/api/enhance/jobs' && req.method === 'POST') {
          const verdict = renderLimiter.take(renderRateLimitKey(req, trustProxy));
          if (!verdict.allowed) {
            res.setHeader('Retry-After', String(verdict.retryAfterSeconds));
            sendJson(res, 429, { error: 'Render rate limit reached. Try again later.' });
            return;
          }
        }
        const body = req.method === 'POST' ? await readRequestBody(req) : undefined;
        await handleRenderJobsRequest(
          enhanceJobs,
          res,
          req.method,
          pathname,
          body,
          '/api/enhance/jobs',
        );
        return;
      }

      if (pathname === '/api/render' || pathname === '/api/render/suggest') {
        const verdict = renderLimiter.take(renderRateLimitKey(req, trustProxy));
        if (!verdict.allowed) {
          res.setHeader('Retry-After', String(verdict.retryAfterSeconds));
          sendJson(res, 429, { error: 'Render rate limit reached. Try again later.' });
          return;
        }
        const body = await readRequestBody(req);
        if (pathname === '/api/render/suggest') {
          await handleSuggestRequest(res, req.method, body);
        } else {
          await handleRenderRequest(res, req.method, body);
        }
        return;
      }

      await serveStatic(req, res, pathname, distDir);
    } catch (error) {
      console.error('Unhandled server error', error);
      if (!res.headersSent) sendJson(res, 500, { error: 'Internal server error' });
      else res.end();
    }
  };
}
