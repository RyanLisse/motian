import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

let redisClient: Redis | undefined;

/**
 * Returns a shared Upstash Redis client.
 * Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars.
 * Returns undefined when not configured — callers should fall back gracefully.
 */
export function getRedis(): Redis | undefined {
  if (redisClient) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return undefined;

  redisClient = new Redis({ url, token });
  return redisClient;
}

/**
 * Creates an Upstash-backed sliding window rate limiter.
 * Falls back to the in-memory rate limiter when Upstash is not configured.
 */
export function createUpstashRateLimiter(config: {
  /** Max requests per window */
  limit: number;
  /** Window duration string, e.g. "60 s", "10 m" */
  window: `${number} ${"ms" | "s" | "m" | "h" | "d"}`;
  /** Prefix for Redis keys */
  prefix?: string;
}) {
  const redis = getRedis();
  if (!redis) return null;

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.limit, config.window),
    prefix: config.prefix ?? "rl",
    analytics: true,
  });
}

const CACHE_PREFIX = "cache:";

/**
 * Redis-backed query cache with TTL.
 * Returns cached value if available, otherwise calls the factory and caches.
 * Falls back to executing the factory directly when Redis is not configured.
 */
export async function cachedQuery<T>(
  key: string,
  factory: () => Promise<T>,
  ttlSeconds = 60,
): Promise<T> {
  const redis = getRedis();
  if (!redis) return factory();

  const cacheKey = `${CACHE_PREFIX}${key}`;

  try {
    const cached = await redis.get<T>(cacheKey);
    if (cached !== null && cached !== undefined) {
      return cached;
    }
  } catch {
    // Redis read failure — fall through to factory
  }

  const result = await factory();

  try {
    await redis.set(cacheKey, result, { ex: ttlSeconds });
  } catch {
    // Redis write failure — result is still returned
  }

  return result;
}

/**
 * Invalidate a cached query by key.
 */
export async function invalidateCache(key: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.del(`${CACHE_PREFIX}${key}`);
  } catch {
    // Best effort
  }
}

/**
 * Invalidate all cached queries matching a pattern.
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    const keys = await redis.keys(`${CACHE_PREFIX}${pattern}`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Best effort
  }
}
