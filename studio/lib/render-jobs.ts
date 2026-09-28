import { randomUUID } from 'node:crypto';
import { AIRenderError, runOpenAIImageRender } from './openai-image-render.js';
import type { AIRenderRequest, AIRenderResult } from './ai-render-contract.js';

/**
 * Async render jobs: a high-resolution render takes minutes, and every proxy
 * between the browser and this server enforces some response deadline —
 * Cloudflare's proxy read timeout is 125s and not configurable below
 * Enterprise (a measured 2880x2880 render took 124s: one second of luck).
 * Submitting a job and polling its status keeps every HTTP exchange
 * sub-second, so no layer's timeout is ever in play.
 *
 * The store is in-memory and single-container by design, like the render
 * rate limiter next to it: a redeploy drops in-flight jobs and the client
 * reports that as a failed render the user can retry. Results are multi-MB
 * base64 payloads, so a job is deleted on first delivery and swept by TTL.
 */

export type RenderJobState<Result = AIRenderResult> =
  | { status: 'running' }
  | { status: 'done'; result: Result }
  | { status: 'error'; httpStatus: number; error: string };

type Job<Result> = { state: RenderJobState<Result>; expiresAt: number };

const JOB_TTL_MS = 10 * 60_000;
// Global spend/memory backstop behind the per-client rate limiter.
const MAX_ACTIVE_JOBS = 8;

export const RENDER_JOB_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Runner<Request, Result> = (request: Request) => Promise<Result>;

export class RenderJobStore<Request = AIRenderRequest, Result = AIRenderResult> {
  private readonly jobs = new Map<string, Job<Result>>();
  private readonly runner: Runner<Request, Result>;
  private readonly now: () => number;
  private readonly failureMessage: string;

  constructor(
    runner: Runner<Request, Result> = runOpenAIImageRender as unknown as Runner<Request, Result>,
    now: () => number = Date.now,
    failureMessage = 'AI material render failed.',
  ) {
    this.failureMessage = failureMessage;
    this.runner = runner;
    this.now = now;
  }

  private sweep(): void {
    const cutoff = this.now();
    for (const [id, job] of this.jobs) {
      if (job.expiresAt <= cutoff) this.jobs.delete(id);
    }
  }

  create(request: Request): string {
    this.sweep();
    if (this.jobs.size >= MAX_ACTIVE_JOBS) {
      throw new AIRenderError(429, 'Too many renders in flight. Try again in a minute.');
    }
    const id = randomUUID();
    const job: Job<Result> = { state: { status: 'running' }, expiresAt: this.now() + JOB_TTL_MS };
    this.jobs.set(id, job);
    this.runner(request)
      .then((result) => {
        job.state = { status: 'done', result };
        job.expiresAt = this.now() + JOB_TTL_MS;
      })
      .catch((error: unknown) => {
        job.state = {
          status: 'error',
          httpStatus: error instanceof AIRenderError ? error.status : 500,
          error: error instanceof AIRenderError ? error.message : this.failureMessage,
        };
        job.expiresAt = this.now() + JOB_TTL_MS;
      });
    return id;
  }

  /** Returns the job state, deleting the job once a terminal state is read. */
  poll(id: string): RenderJobState<Result> | null {
    this.sweep();
    const job = this.jobs.get(id);
    if (!job) return null;
    if (job.state.status !== 'running') this.jobs.delete(id);
    return job.state;
  }

  /** Test/diagnostic surface only. */
  get size(): number {
    this.sweep();
    return this.jobs.size;
  }
}
