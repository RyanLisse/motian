import { createUpstashRateLimiter } from "./upstash";

type RateLimitConfig = {
  interval: number;
  limit: number;
};

type RateLimitEntry = { count: number; resetTime: number };
type RateLimitResult = { success: boolean; remaining: number; reset: number };

/**
 * Globally enforced sliding window rate limiter.
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL is configured for
 * cross-instance enforcement. Falls back to per-process in-memory limiting.
 */
export function rateLimit(config: RateLimitConfig) {
  const store = new Map<string, RateLimitEntry>();
  const upstash = createUpstashRateLimiter({
    limit: config.limit,
    window: intervalToWindow(config.interval),
    prefix: "rl",
  });

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
      if (!upstash) return checkLocal(key);

      return upstash
        .limit(key)
        .then((result) => ({
          success: result.success,
          remaining: result.remaining,
          reset: result.reset,
        }))
        .catch(() => {
          // Upstash failure — fall back to local + permit traffic
          return checkLocal(key);
        });
    },
  };
}

function intervalToWindow(ms: number): `${number} ${"ms" | "s" | "m" | "h"}` {
  if (ms >= 3_600_000 && ms % 3_600_000 === 0) return `${ms / 3_600_000} h`;
  if (ms >= 60_000 && ms % 60_000 === 0) return `${ms / 60_000} m`;
  if (ms >= 1_000 && ms % 1_000 === 0) return `${ms / 1_000} s`;
  return `${ms} ms`;
}
