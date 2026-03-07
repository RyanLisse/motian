const DEFAULT_DEV_ORIGINS = ["http://localhost:3001", "http://127.0.0.1:3001"];

type CorsEnv = Partial<Pick<NodeJS.ProcessEnv, "ALLOWED_ORIGINS" | "NODE_ENV">>;

export function parseAllowedOrigins(value: string | undefined): string[] {
  if (!value) return [];

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function getCorsAllowlist(env: CorsEnv = process.env): string[] {
  const configuredOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
  if (configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  return env.NODE_ENV === "development" ? DEFAULT_DEV_ORIGINS : [];
}

export function getAllowedCorsOrigin(
  origin: string | null,
  env: CorsEnv = process.env,
): string | null {
  if (!origin) return null;

  const allowlist = getCorsAllowlist(env);
  return allowlist.includes(origin) ? origin : null;
}

export function shouldRejectCorsPreflight(
  origin: string | null,
  env: CorsEnv = process.env,
): boolean {
  if (!origin) return false;

  const allowlist = getCorsAllowlist(env);
  return allowlist.length > 0 && !allowlist.includes(origin);
}

export function buildCorsHeaders(
  origin: string | null,
  env: CorsEnv = process.env,
): Record<string, string> {
  const allowedOrigin = getAllowedCorsOrigin(origin, env);

  return {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-Requested-With",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin, Access-Control-Request-Headers",
    ...(allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin } : {}),
  };
}
