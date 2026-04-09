/**
 * Platform status adapter registry.
 *
 * Each platform can register an adapter that fetches platform-side stats
 * (views, applications, availability). Platforms without a real adapter
 * fall back to the stub which simply reports "available, no metrics".
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlatformStatusRequest {
  platform: string;
  configId: string;
}

export interface PlatformStatus {
  platform: string;
  available: boolean;
  metrics?: {
    views?: number;
    applications?: number;
  };
}

export interface PlatformStatusAdapter {
  fetchStatus(request: PlatformStatusRequest): Promise<PlatformStatus>;
}

// ---------------------------------------------------------------------------
// Stub adapter — used for platforms without a real implementation
// ---------------------------------------------------------------------------

export const stubAdapter: PlatformStatusAdapter = {
  async fetchStatus(request) {
    return {
      platform: request.platform,
      available: true,
      metrics: undefined,
    };
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const adapterRegistry = new Map<string, PlatformStatusAdapter>();

// TODO: Add Striive adapter when RJC-54 write API is discovered

/**
 * Register a status adapter for a specific platform slug.
 */
export function registerStatusAdapter(platformSlug: string, adapter: PlatformStatusAdapter): void {
  adapterRegistry.set(platformSlug, adapter);
}

/**
 * Get the status adapter for a platform. Falls back to stubAdapter
 * if no specific adapter is registered.
 */
export function getStatusAdapter(platformSlug: string): PlatformStatusAdapter {
  return adapterRegistry.get(platformSlug) ?? stubAdapter;
}
