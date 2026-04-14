import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

const MISSING_DATABASE_ENV_ERROR = "DATABASE_URL is not set";

const PUBLIC_DATABASE_URL_ERROR =
  "NEXT_PUBLIC_DATABASE_URL is set. Keep the Neon connection string server-only in DATABASE_URL.";

const POOLER_HINT =
  "[db-pool] HINT: DATABASE_URL does not use Neon's connection pooler (-pooler.). " +
  "For serverless deployments, using the pooler endpoint reduces cold-start latency by ~100-200ms. " +
  "Update the hostname in DATABASE_URL from '<project>.neon.tech' to '<project>-pooler.neon.tech'.";

function getNeonUrl(): string | undefined {
  return process.env.DATABASE_URL?.trim();
}

function isPoolerEndpoint(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes("-pooler.");
  } catch {
    return false;
  }
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
const MAX_TIMING_SAMPLES = 100;
let connectTimings: number[] = [];
let hasBeenUsed = false;

function attachPoolListeners(pool: Pool): void {
  pool.on("connect", () => {
    hasBeenUsed = true;
    connectTimings.push(Date.now());
    if (connectTimings.length > MAX_TIMING_SAMPLES) {
      connectTimings = connectTimings.slice(-MAX_TIMING_SAMPLES);
    }
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

function createNeonDatabaseClient(): DatabaseClient {
  assertNoPublicDatabaseUrl();

  const url = getNeonUrl();
  if (!url) throw new Error(MISSING_DATABASE_ENV_ERROR);

  if (!isPoolerEndpoint(url)) {
    console.warn(POOLER_HINT);
  }

  // max: 1 is correct for Vercel serverless — each invocation gets its own
  // process. Higher values multiply connections across concurrent invocations
  // and exhaust Neon's per-project connection limit under load. Use Neon's
  // connection pooler endpoint (hostname contains "-pooler.") for multiplexing.
  // Node.js 22 has native WebSocket — no ws package or neonConfig needed.
  const pool = new Pool({
    connectionString: url,
    max: 1,
    connectionTimeoutMillis: 5_000,
  });

  poolRef = pool;
  attachPoolListeners(pool);

  return drizzle(pool);
}

type DatabaseClient = ReturnType<typeof drizzle>;

let databaseClient: DatabaseClient | undefined;

function getDatabaseClient(): DatabaseClient {
  databaseClient ??= createNeonDatabaseClient();
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
