const TOOL_CACHE_TTL_MS = 30_000; // 30 seconds

type CachedResult = { value: unknown; expiresAt: number };

export function createToolResultCache() {
  const cache = new Map<string, CachedResult>();

  function cacheKey(toolName: string, args: unknown): string {
    return `${toolName}:${JSON.stringify(args)}`;
  }

  return {
    get(toolName: string, args: unknown): unknown | undefined {
      const key = cacheKey(toolName, args);
      const cached = cache.get(key);
      if (!cached || cached.expiresAt <= Date.now()) {
        cache.delete(key);
        return undefined;
      }
      return cached.value;
    },
    set(toolName: string, args: unknown, value: unknown): void {
      const key = cacheKey(toolName, args);
      cache.set(key, { value, expiresAt: Date.now() + TOOL_CACHE_TTL_MS });
    },
  };
}

export type ToolResultCache = ReturnType<typeof createToolResultCache>;
