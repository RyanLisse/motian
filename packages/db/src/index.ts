import { createClient } from "@libsql/client";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const MISSING_DATABASE_ENV_ERROR =
  "DATABASE_URL is not set and TURSO_DATABASE_URL is not set. Set DATABASE_URL for Neon (primary), or TURSO_DATABASE_URL for Turso fallback.";

const NEON_INIT_FAILED_PREFIX =
  "Neon initialization failed, falling back to Turso when available.";

function getNeonUrl(): string | undefined {
  const url = process.env.DATABASE_URL?.trim();
  return url ? url : undefined;
}

function getTursoConfig():
  | {
      url: string;
      authToken: string | undefined;
    }
  | undefined {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  if (!url) return undefined;

  return {
    url,
    authToken: process.env.TURSO_AUTH_TOKEN?.trim(),
  };
}

function createNeonDatabaseClient(url: string) {
  const pool = new Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  return drizzlePg(pool);
}

function createTursoDatabaseClient(config: { url: string; authToken: string | undefined }) {
  const client = createClient(config);
  return drizzleLibsql(client);
}

function createDatabaseClient() {
  const neonUrl = getNeonUrl();
  const tursoConfig = getTursoConfig();

  if (!neonUrl && !tursoConfig) {
    throw new Error(MISSING_DATABASE_ENV_ERROR);
  }

  if (neonUrl) {
    try {
      return createNeonDatabaseClient(neonUrl);
    } catch (error) {
      console.warn(
        `${NEON_INIT_FAILED_PREFIX} ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (tursoConfig) {
    return createTursoDatabaseClient(tursoConfig);
  }

  throw new Error(
    "DATABASE_URL is set but Neon failed to initialize, and TURSO_DATABASE_URL is not set for fallback.",
  );
}

type DatabaseClient =
  | ReturnType<typeof createNeonDatabaseClient>
  | ReturnType<typeof createTursoDatabaseClient>;

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
  like,
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
