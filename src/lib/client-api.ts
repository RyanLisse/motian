/**
 * Client-safe API helpers. Rewrites `/api/...` to `/bff/...` so the browser
 * never needs `API_SECRET` — the BFF route attaches the bearer server-side.
 *
 * Public GET paths (`/api/vacatures/zoeken`, `/api/gezondheid`, …) may still
 * be called directly; using `apiFetch` for them is harmless.
 */

/** `/api/cv-upload` → `/bff/cv-upload` (preserves query string). */
export function toBffPath(path: string): string {
  if (path.startsWith("/bff/")) return path;
  if (path.startsWith("/api/")) return `/bff/${path.slice("/api/".length)}`;
  if (path.startsWith("api/")) return `/bff/${path.slice("api/".length)}`;
  return path;
}

/**
 * Drop-in `fetch` wrapper for first-party product calls. Prefer this over raw
 * `fetch("/api/...")` whenever `API_SECRET` may be set in the environment.
 */
export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(toBffPath(input), init);
}
