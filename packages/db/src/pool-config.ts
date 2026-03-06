import type { PoolConfig } from "pg";

type PoolSslConfig = NonNullable<PoolConfig["ssl"]>;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const SSL_REQUIRED_MODES = new Set(["require", "verify-ca", "verify-full"]);
const SSL_DISABLED_MODES = new Set(["disable", "allow", "prefer"]);

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
