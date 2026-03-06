import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getPoolSslConfig } from "./pool-config";

function normalizeConnectionString(url: string): string {
  try {
    const parsed = new URL(url);
    const ssl = parsed.searchParams.get("sslmode")?.toLowerCase();
    if (ssl === "prefer" || ssl === "require" || ssl === "verify-ca") {
      parsed.searchParams.set("sslmode", "verify-full");
      return parsed.toString();
    }
    return url;
  } catch {
    return url;
  }
}

function getConnectionString(): string {
  const rawUrl = process.env.DATABASE_URL?.trim() ?? "";
  if (!rawUrl) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local (see .env.example). Without it, database pages (e.g. /overzicht) will fail with SASL/connection errors.",
    );
  }

  return normalizeConnectionString(rawUrl);
}

let pool: Pool | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;

function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  const connectionString = getConnectionString();
  pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
    ssl: getPoolSslConfig(connectionString),
  });

  // Prevent silent crashes on dropped connections
  pool.on("error", (err) => {
    console.error("Onverwachte pool fout:", err.message);
  });

  dbInstance = drizzle(pool);
  return dbInstance;
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
export * from "./schema";
