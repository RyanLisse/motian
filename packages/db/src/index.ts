import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const MISSING_DATABASE_ENV_ERROR = "DATABASE_URL is not set";

const PUBLIC_DATABASE_URL_ERROR =
  "NEXT_PUBLIC_DATABASE_URL is set. Keep the Neon connection string server-only in DATABASE_URL.";

function getNeonUrl(): string | undefined {
  return process.env.DATABASE_URL?.trim();
}

function assertNoPublicDatabaseUrl(): void {
  if (process.env.NEXT_PUBLIC_DATABASE_URL?.trim()) {
    throw new Error(PUBLIC_DATABASE_URL_ERROR);
  }
}

// ---------------------------------------------------------------------------
// Pool metrics
// ---------------------------------------------------------------------------

interface PoolMetrics {
  total: number;
  idle: number;
  waiting: number;
  errors: number;
  avgConnectMs: number;
}

let poolRef: Pool | undefined;
let connectErrors = 0;
let connectTimings: number[] = [];
let hasBeenUsed = false;

function attachPoolListeners(pool: Pool): void {
  pool.on("connect", () => {
    hasBeenUsed = true;
    connectTimings.push(Date.now());
  });

  pool.on("acquire", () => {
    hasBeenUsed = true;
  });

  pool.on("error", () => {
    connectErrors++;
  });

  pool.on("remove", () => {
    // Connection removed from pool — no action needed beyond live stats
  });

  // Periodic metrics logger — unref so it never keeps the process alive
  const interval = setInterval(() => {
    if (!hasBeenUsed) return;
    const m = getPoolMetrics();
    console.log(
      `[db-pool] total=${m.total} idle=${m.idle} waiting=${m.waiting} errors=${m.errors} avgConnectMs=${m.avgConnectMs}`,
    );
  }, 60_000);
  interval.unref();
}

/**
 * Returns a snapshot of the current pool health metrics.
 */
export function getPoolMetrics(): PoolMetrics {
  const pool = poolRef;
  const avg =
    connectTimings.length >= 2
      ? Math.round(
          (connectTimings[connectTimings.length - 1] - connectTimings[0]) /
            (connectTimings.length - 1),
        )
      : 0;

  return {
    total: pool?.totalCount ?? 0,
    idle: pool?.idleCount ?? 0,
    waiting: pool?.waitingCount ?? 0,
    errors: connectErrors,
    avgConnectMs: avg,
  };
}

function createNeonDatabaseClient(url: string): DatabaseClient {
  const pool = new Pool({
    connectionString: url,
    max: 10,
    idleTimeoutMillis: 60_000,
    connectionTimeoutMillis: 5_000,
  });

  poolRef = pool;
  attachPoolListeners(pool);

  return drizzlePg(pool);
}

function createDatabaseClient(): DatabaseClient {
  assertNoPublicDatabaseUrl();

  const neonUrl = getNeonUrl();

  if (!neonUrl) {
    throw new Error(MISSING_DATABASE_ENV_ERROR);
  }

  return createNeonDatabaseClient(neonUrl);
}

type DatabaseClient = ReturnType<typeof drizzlePg>;

let databaseClient: DatabaseClient | undefined;

function getDatabaseClient(): DatabaseClient {
  databaseClient ??= createDatabaseClient();
  return databaseClient;
}

export const db = new Proxy({} as DatabaseClient, {
  get(_target, prop, receiver) {
    const client = getDatabaseClient();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === "function") {
      return value.bind(client);
    }

    return value;
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
