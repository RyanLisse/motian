/**
 * Upstash Redis integration for global rate limiting and query caching.
 *
 * To activate:
 *   1. pnpm add @upstash/redis @upstash/ratelimit
 *   2. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars
 *
 * All functions fall through gracefully when packages are missing or
 * env vars are not set — callers should always provide fallbacks.
 */

const CACHE_PREFIX = "cache:";
let redisUnavailable = false;

// biome-ignore lint/suspicious/noExplicitAny: lazy-loaded optional peer dep
let redisClient: any;

async function getRedis() {
  if (redisClient) return redisClient;
  if (redisUnavailable) return null;

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    redisUnavailable = true;
    return null;
  }

  try {
    const { Redis } = await import("@upstash/redis");
    redisClient = new Redis({ url, token });
    return redisClient;
  } catch {
    redisUnavailable = true;
    return null;
  }
}

/**
 * Redis-backed query cache with TTL.
 * Falls back to executing the factory directly when Redis is not available.
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
    let cursor = 0;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, {
        match: `${CACHE_PREFIX}${pattern}`,
        count: 100,
      });
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      cursor = Number(nextCursor);
    } while (cursor !== 0);
  } catch {
    // Best effort
  }
}
