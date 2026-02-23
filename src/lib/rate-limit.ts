type RateLimitConfig = {
  interval: number;
  limit: number;
};

type RateLimitEntry = { count: number; resetTime: number };
type RateLimitResult = { success: boolean; remaining: number; reset: number };

/**
 * In-memory sliding window rate limiter.
 * Note: On serverless (Vercel), state resets on cold starts and is per-instance.
 * For production, upgrade to @upstash/ratelimit with Redis for global enforcement.
 */
export function rateLimit(config: RateLimitConfig) {
  const store = new Map<string, RateLimitEntry>();

  function prune(now: number) {
    const cutoff = now - config.interval * 2;
    for (const [key, entry] of store) {
      if (entry.resetTime < cutoff) store.delete(key);
    }
  }

  return {
    check(key: string): RateLimitResult {
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
    },
  };
}
