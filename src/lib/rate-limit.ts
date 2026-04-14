import { createUpstashRateLimiter } from "./upstash";

type RateLimitConfig = {
  interval: number;
  limit: number;
};

type RateLimitEntry = { count: number; resetTime: number };
type RateLimitResult = { success: boolean; remaining: number; reset: number };

function intervalToWindow(ms: number): string {
  if (ms >= 3_600_000 && ms % 3_600_000 === 0) return `${ms / 3_600_000} h`;
  if (ms >= 60_000 && ms % 60_000 === 0) return `${ms / 60_000} m`;
  if (ms >= 1_000 && ms % 1_000 === 0) return `${ms / 1_000} s`;
  return `${ms} ms`;
}

/** True when Upstash env vars are present — checked synchronously to avoid async on the hot path. */
function isUpstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

/**
 * Globally enforced sliding window rate limiter.
 * Uses Upstash Redis when @upstash/redis is installed and
 * UPSTASH_REDIS_REST_URL is configured. Falls back to per-process
 * in-memory limiting otherwise (synchronous path — no Promises).
 */
export function rateLimit(config: RateLimitConfig) {
  const store = new Map<string, RateLimitEntry>();
  const useUpstash = isUpstashConfigured();

  // Lazy-init Upstash limiter only when env vars are set
  // biome-ignore lint/suspicious/noExplicitAny: optional peer dep type
  let upstash: any | null | undefined;
  // biome-ignore lint/suspicious/noExplicitAny: optional peer dep type
  let upstashPromise: Promise<any> | undefined;

  function ensureUpstash() {
    if (upstash !== undefined) return upstash;
    if (!upstashPromise) {
      upstashPromise = createUpstashRateLimiter({
        limit: config.limit,
        window: intervalToWindow(config.interval),
        prefix: "rl",
      }).then((rl) => {
        upstash = rl ?? null;
        return upstash;
      });
    }
    return upstashPromise;
  }

  function prune(now: number) {
    const cutoff = now - config.interval * 2;
    for (const [key, entry] of store) {
      if (entry.resetTime < cutoff) store.delete(key);
    }
  }

  function checkLocal(key: string): RateLimitResult {
    const now = Date.now();
    prune(now);

    const entry = store.get(key);

    if (!entry || now >= entry.resetTime) {
      const resetTime = now + config.interval;
      store.set(key, { count: 1, resetTime });
      return { success: true, remaining: config.limit - 1, reset: resetTime };
    }

    entry.count++;
    const remaining = Math.max(0, config.limit - entry.count);
    const success = entry.count <= config.limit;
    return { success, remaining, reset: entry.resetTime };
  }

  return {
    check(key: string): RateLimitResult | Promise<RateLimitResult> {
      // Synchronous fast path when Upstash is not configured
      if (!useUpstash) return checkLocal(key);

      // Upstash is configured — resolved instance available
      if (upstash) {
        return upstash
          .limit(key)
          .then((result: { success: boolean; remaining: number; reset: number }) => ({
            success: result.success,
            remaining: result.remaining,
            reset: result.reset,
          }))
          .catch(() => checkLocal(key));
      }

      // Upstash init failed previously
      if (upstash === null) return checkLocal(key);

      // First call with Upstash configured — lazy init
      return Promise.resolve(ensureUpstash())
        .then((rl) => {
          if (!rl) return checkLocal(key);
          return rl
            .limit(key)
            .then((result: { success: boolean; remaining: number; reset: number }) => ({
              success: result.success,
              remaining: result.remaining,
              reset: result.reset,
            }))
            .catch(() => checkLocal(key));
        })
        .catch(() => checkLocal(key));
    },
  };
}
