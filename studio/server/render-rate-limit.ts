import type { IncomingMessage } from 'node:http';

/**
 * Spending guard for the paid render endpoint — NOT authentication. The
 * editor is deliberately public (Jodok, 2026-08-25), but /api/render turns
 * a request into an OpenAI charge whenever OPENAI_API_KEY is configured, so
 * the self-hosted server caps how fast any one client can spend. A single
 * long-lived process, so an in-memory sliding window is a real limit.
 *
 * RENDER_MAX_PER_HOUR overrides the budget; 0 disables the guard (for a
 * deployment that has its own protection in front).
 */
const DEFAULT_MAX_PER_HOUR = 10;
const WINDOW_MS = 60 * 60 * 1000;
const MAX_KEYS = 10_000;

export function renderRateLimitBudget(env: Record<string, string | undefined> = process.env): number {
  const raw = env.RENDER_MAX_PER_HOUR;
  if (raw === undefined || raw === '') return DEFAULT_MAX_PER_HOUR;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : DEFAULT_MAX_PER_HOUR;
}

export function renderRateLimitTrustProxy(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.TRUST_PROXY === '1';
}

/**
 * X-Forwarded-For is client-forgeable, so it is only honored when the
 * deployment declares a trusted proxy in front (TRUST_PROXY=1 — the estate's
 * rp OVERWRITES the header with Cloudflare's CF-Connecting-IP, one trusted
 * value). Without that declaration — e.g. the documented direct
 * `docker run` — the key is the socket address, which a caller cannot mint
 * fresh per request.
 */
export function renderRateLimitKey(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const header = req.headers['x-forwarded-for'];
    const raw = Array.isArray(header) ? header[0] : header;
    const forwarded = raw?.split(',')[0]?.trim();
    if (forwarded) return forwarded;
  }
  return req.socket.remoteAddress || 'unknown-source';
}

export type RenderRateLimiter = {
  /** Reserve one render; not allowed carries the Retry-After seconds. */
  take(key: string, now?: number): { allowed: true } | { allowed: false; retryAfterSeconds: number };
};

export function createRenderRateLimiter(
  maxPerHour: number,
  windowMs = WINDOW_MS,
  maxKeys = MAX_KEYS,
): RenderRateLimiter {
  const attempts = new Map<string, number[]>();

  // Same bounded-map discipline as the removed login limiter: a caller
  // spraying fresh header-derived keys must not grow memory for the life
  // of the process. Sweep expired entries past the cap, then evict
  // oldest-inserted — biased eviction beats unbounded RSS.
  function sweep(now: number): void {
    if (attempts.size <= maxKeys) return;
    for (const [key, timestamps] of attempts) {
      const live = timestamps.filter((ts) => now - ts < windowMs);
      if (live.length > 0) attempts.set(key, live);
      else attempts.delete(key);
    }
    if (attempts.size > maxKeys) {
      const excess = attempts.size - maxKeys;
      let evicted = 0;
      for (const key of attempts.keys()) {
        if (evicted >= excess) break;
        attempts.delete(key);
        evicted += 1;
      }
    }
  }

  return {
    take(key: string, now = Date.now()) {
      if (maxPerHour === 0) return { allowed: true };
      sweep(now);
      const live = (attempts.get(key) ?? []).filter((ts) => now - ts < windowMs);
      if (live.length >= maxPerHour) {
        const oldest = live[0] ?? now;
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
        };
      }
      live.push(now);
      attempts.set(key, live);
      return { allowed: true };
    },
  };
}
