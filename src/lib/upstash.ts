/**
 * Upstash Redis integration for global rate limiting and query caching.
 *
 * Requires optional peer dependencies: @upstash/redis, @upstash/ratelimit
 * Install them and set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN to activate.
 * When packages are not installed or env vars are missing, all functions
 * return null / fall through gracefully — callers should always provide fallbacks.
 */

// biome-ignore lint/suspicious/noExplicitAny: dynamic imports for optional peer deps
type RedisClient = any;
// biome-ignore lint/suspicious/noExplicitAny: dynamic imports for optional peer deps
type RatelimitInstance = any;

let redisClient: RedisClient | undefined;
let redisUnavailable = false;

/**
 * Returns a shared Upstash Redis client.
 * Returns undefined when not configured or package is missing.
 */
export async function getRedis(): Promise<RedisClient | undefined> {
  if (redisClient) return redisClient;
  if (redisUnavailable) return undefined;

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    redisUnavailable = true;
    return undefined;
  }

  try {
    const { Redis } = await import("@upstash/redis");
    redisClient = new Redis({ url, token });
    return redisClient;
  } catch {
    redisUnavailable = true;
    return undefined;
  }
}

let ratelimitUnavailable = false;

/**
 * Creates an Upstash-backed sliding window rate limiter.
 * Returns null when packages are not installed or env vars are missing.
 */
export async function createUpstashRateLimiter(config: {
  limit: number;
  window: string;
  prefix?: string;
}): Promise<RatelimitInstance | null> {
  if (ratelimitUnavailable) return null;

  const redis = await getRedis();
  if (!redis) return null;

  try {
    const { Ratelimit } = await import("@upstash/ratelimit");
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.limit, config.window),
      prefix: config.prefix ?? "rl",
      analytics: true,
    });
  } catch {
    ratelimitUnavailable = true;
    return null;
  }
}

const CACHE_PREFIX = "cache:";

/**
 * Redis-backed query cache with TTL.
 * Falls back to executing the factory directly when Redis is not configured.
 */
export async function cachedQuery<T>(
  key: string,
  factory: () => Promise<T>,
  ttlSeconds = 60,
): Promise<T> {
  const redis = await getRedis();
  if (!redis) return factory();

  const cacheKey = `${CACHE_PREFIX}${key}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached !== null && cached !== undefined) {
      return cached as T;
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
  const redis = await getRedis();
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
  const redis = await getRedis();
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
