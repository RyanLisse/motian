/**
 * Standardized Cache-Control headers for API routes.
 *
 * Policies:
 *  - static:     Rarely-changing data (health, config, catalogs, ESCO data).
 *                Cached 5 min at CDN, stale for 10 min while revalidating.
 *  - revalidate: Semi-static lists (vacancies, candidates, dashboard data).
 *                Cached 60s at CDN, stale for 2 min while revalidating.
 *  - dynamic:    User-specific or mutation responses (chat, POST/PUT/DELETE).
 *                Never cached.
 */

type CachePolicy = "static" | "dynamic" | "revalidate";

const CACHE_HEADERS: Record<CachePolicy, Record<string, string>> = {
  static: {
    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
  },
  revalidate: {
    "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
  },
  dynamic: {
    "Cache-Control": "no-store",
  },
};

export function cacheHeaders(policy: CachePolicy): HeadersInit {
  return CACHE_HEADERS[policy];
}
