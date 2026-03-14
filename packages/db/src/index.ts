import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getPoolConfig } from "./pool-config";

const MISSING_DATABASE_URL_ERROR =
  "DATABASE_URL is not set. Add it to .env.local (see .env.example). Without it, database-backed routes will fail when they try to access the database.";

function normalizeConnectionString(url: string): string {
  try {
    const parsed = new URL(url);
    const ssl = parsed.searchParams.get("sslmode")?.toLowerCase();

    // Always enforce verify-full for security
    // Upgrade weak modes (prefer, require, verify-ca) or add if missing
    if (!ssl || ssl === "prefer" || ssl === "require" || ssl === "verify-ca") {
      parsed.searchParams.set("sslmode", "verify-full");
      return parsed.toString();
    }

    // Already has verify-full or disable (explicit choice)
    return url;
  } catch {
    return url;
  }
}

function getConnectionString(): string {
  const rawUrl = process.env.DATABASE_URL?.trim() ?? "";
  if (!rawUrl) {
    throw new Error(MISSING_DATABASE_URL_ERROR);
  }

  return normalizeConnectionString(rawUrl);
}

function createDatabaseClient() {
  const connectionString = getConnectionString();
  const pool = new Pool(getPoolConfig(connectionString));

  // Prevent silent crashes on dropped connections
  pool.on("error", (err) => {
    console.error("Onverwachte pool fout:", err.message);
  });

  return drizzle(pool);
}

type DatabaseClient = ReturnType<typeof createDatabaseClient>;

let databaseClient: DatabaseClient | undefined;

function getDatabaseClient(): DatabaseClient {
  databaseClient ??= createDatabaseClient();
  return databaseClient;
}

export const db = new Proxy({} as DatabaseClient, {
  get(_target, prop, receiver) {
    const client = getDatabaseClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
  has(_target, prop) {
    return prop in getDatabaseClient();
  },
  ownKeys() {
    return Reflect.ownKeys(getDatabaseClient());
  },
  getOwnPropertyDescriptor(_target, prop) {
    return Object.getOwnPropertyDescriptor(getDatabaseClient(), prop);
  },
}) as DatabaseClient;

export {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
export * from "./schema";
