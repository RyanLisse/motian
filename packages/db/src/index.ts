import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

function createDatabaseClient() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is not set. A Neon PostgreSQL connection string is required.");
  }

  const pool = new Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  return drizzle(pool);
}

type DatabaseClient = ReturnType<typeof drizzle>;

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
