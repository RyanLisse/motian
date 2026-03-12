import type { PoolConfig } from "pg";

type PoolSslConfig = NonNullable<PoolConfig["ssl"]>;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const SSL_REQUIRED_MODES = new Set(["require", "verify-ca", "verify-full"]);
const SSL_DISABLED_MODES = new Set(["disable", "allow", "prefer"]);
const DEFAULT_DB_POOL_MAX = 5;
const DEFAULT_DB_POOL_IDLE_TIMEOUT_MS = 10_000;
const DEFAULT_DB_POOL_CONNECTION_TIMEOUT_MS = 5_000;

function parseBoundedIntegerEnv(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(Math.max(parsed, min), max);
}

export function getPoolSslConfig(connectionString: string): PoolSslConfig | false {
  if (!connectionString) {
    return false;
  }

  try {
    const parsed = new URL(connectionString);
    const sslMode = parsed.searchParams.get("sslmode")?.toLowerCase();

    if (sslMode && SSL_DISABLED_MODES.has(sslMode)) {
      return false;
    }

    if (sslMode && SSL_REQUIRED_MODES.has(sslMode)) {
      return { rejectUnauthorized: false };
    }

    if (LOCAL_HOSTS.has(parsed.hostname) || parsed.hostname.endsWith(".local")) {
      return false;
    }
  } catch {
    return false;
  }

  return { rejectUnauthorized: false };
}

export function getPoolConfig(
  connectionString: string,
  env: NodeJS.ProcessEnv = process.env,
): PoolConfig {
  return {
    connectionString,
    max: parseBoundedIntegerEnv(env.DB_POOL_MAX, DEFAULT_DB_POOL_MAX, 1, 50),
    idleTimeoutMillis: parseBoundedIntegerEnv(
      env.DB_POOL_IDLE_TIMEOUT_MS,
      DEFAULT_DB_POOL_IDLE_TIMEOUT_MS,
      1_000,
      120_000,
    ),
    connectionTimeoutMillis: parseBoundedIntegerEnv(
      env.DB_POOL_CONNECTION_TIMEOUT_MS,
      DEFAULT_DB_POOL_CONNECTION_TIMEOUT_MS,
      500,
      60_000,
    ),
    ssl: getPoolSslConfig(connectionString),
  };
}
