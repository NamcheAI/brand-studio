import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AIRenderRequest, AISuggestRequest } from './lib/ai-render-contract.js'
import { AIRenderError, runOpenAIImageRender } from './lib/openai-image-render.js'
import { runOpenAIMaterialSuggest } from './lib/openai-material-suggest.js'
import { RenderJobStore } from './lib/render-jobs.js'
import { handleRenderJobsRequest } from './server/render-jobs-route.js'
import { runReplicateEnhance } from './lib/replicate-enhance.js'
import type { AIEnhanceRequest, AIEnhanceResult } from './lib/ai-render-contract.js'
import { runOpenAIImageRender as runRender } from './lib/openai-image-render.js'
import { createImageStudioHandler } from './server/image-studio.js'
import { createRenderRateLimiter, renderRateLimitBudget, renderRateLimitKey } from './server/render-rate-limit.js'

const DEV_RENDER_BODY_LIMIT = 12 * 1024 * 1024

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += bytes.byteLength
    if (size > DEV_RENDER_BODY_LIMIT) throw new AIRenderError(413, 'Render request is too large.')
    chunks.push(bytes)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new AIRenderError(400, 'Render request must be valid JSON.')
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(body))
}

function localAIRenderApi(options: {
  apiKey?: string
  model?: string
  suggestModel?: string
  replicateToken?: string
  dataDir?: string
}): Plugin {
  let imageStudio: ReturnType<typeof createImageStudioHandler> | undefined
  const imageLimiter = createRenderRateLimiter(renderRateLimitBudget())
  const jobStore = new RenderJobStore((request) =>
    runRender(request, { apiKey: options.apiKey, model: options.model }),
  )
  const enhanceStore = new RenderJobStore<AIEnhanceRequest, AIEnhanceResult>(
    (request) => runReplicateEnhance(request, { apiToken: options.replicateToken }),
    Date.now,
    'Detail enhancement failed.',
  )
  return {
    name: 'namche-local-ai-render-api',
    configureServer(server) {
      server.middlewares.use(async (request: IncomingMessage, response: ServerResponse, next) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
        if (pathname !== '/api/images' && !pathname.startsWith('/api/images/')) { next(); return }
        if (pathname === '/api/images/jobs' && request.method === 'POST') {
          const verdict = imageLimiter.take(renderRateLimitKey(request, false))
          if (!verdict.allowed) {
            response.setHeader('Retry-After', String(verdict.retryAfterSeconds))
            sendJson(response, 429, { error: 'Render rate limit reached. Try again later.' })
            return
          }
        }
        imageStudio ??= createImageStudioHandler({ apiKey: options.apiKey, model: options.model, dataDir: options.dataDir })
        await imageStudio(request, response, pathname)
      })
      server.middlewares.use('/api/enhance', async (request: IncomingMessage, response: ServerResponse) => {
        const remainder = request.url ?? ''
        try {
          const jobBody = request.method === 'POST' ? await readJsonBody(request) : undefined
          await handleRenderJobsRequest(
            enhanceStore,
            response,
            request.method,
            '/api/enhance' + remainder,
            jobBody,
            '/api/enhance/jobs',
          )
        } catch (error) {
          console.error('Local enhance failed', error)
          sendJson(response, 500, { error: 'Detail enhancement failed.' })
        }
      })
      server.middlewares.use('/api/render', async (request: IncomingMessage, response: ServerResponse) => {
        const remainder = request.url ?? ''
        // The middleware mounts on the /api/render prefix; request.url is
        // the remainder: '/suggest', '/jobs', '/jobs/<id>' or '/'. The jobs
        // route owns its own method handling (GET polls are legitimate), so
        // the POST-only guard must not run ahead of it.
        try {
          if (remainder === '/jobs' || remainder.startsWith('/jobs/')) {
            const jobBody = request.method === 'POST' ? await readJsonBody(request) : undefined
            await handleRenderJobsRequest(
              jobStore,
              response,
              request.method,
              '/api/render' + remainder,
              jobBody,
            )
            return
          }
          if (request.method !== 'POST') {
            response.setHeader('Allow', 'POST')
            sendJson(response, 405, { error: 'Method not allowed.' })
            return
          }
          const body = await readJsonBody(request)
          if (remainder.startsWith('/suggest')) {
            sendJson(
              response,
              200,
              await runOpenAIMaterialSuggest(body as AISuggestRequest, {
                apiKey: options.apiKey,
                model: options.suggestModel,
              }),
            )
          } else {
            sendJson(response, 200, await runOpenAIImageRender(body as AIRenderRequest, options))
          }
        } catch (error) {
          if (error instanceof AIRenderError) {
            sendJson(response, error.status, { error: error.message })
            return
          }
          console.error('Local AI material render failed', error)
          sendJson(response, 500, { error: 'AI material render failed.' })
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      tailwindcss(),
      localAIRenderApi({
        apiKey: env.OPENAI_API_KEY,
        model: env.OPENAI_IMAGE_MODEL,
        suggestModel: env.OPENAI_SUGGEST_MODEL,
        replicateToken: env.REPLICATE_API_TOKEN,
        dataDir: env.IMAGE_STUDIO_DATA_DIR,
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
