const DEFAULT_INTERNAL_SERVER_URL = "http://127.0.0.1:3001";

const INTERNAL_SERVER_URL_KEYS = [
  "INTERNAL_SERVER_URL",
  "PUBLIC_API_BASE_URL",
  "NEXT_URL",
] as const;

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isUsableUrl(value: string | undefined): value is string {
  if (!value) return false;

  const trimmed = value.trim();
  if (trimmed.length === 0) return false;

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** Resolve the base URL for server-to-self HTTP calls (loopback inside Docker/Coolify). */
export function resolveInternalServerUrl(env: NodeJS.ProcessEnv = process.env): string {
  for (const key of INTERNAL_SERVER_URL_KEYS) {
    const candidate = env[key];
    if (isUsableUrl(candidate)) {
      return trimTrailingSlash(candidate.trim());
    }
  }

  return DEFAULT_INTERNAL_SERVER_URL;
}

/** True when INTERNAL_SERVER_URL, PUBLIC_API_BASE_URL, or NEXT_URL is set to a usable URL. */
export function hasExplicitInternalServerUrl(env: NodeJS.ProcessEnv = process.env): boolean {
  return INTERNAL_SERVER_URL_KEYS.some((key) => isUsableUrl(env[key]));
}
