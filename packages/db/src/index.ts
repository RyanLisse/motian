import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";

const MISSING_DATABASE_URL_ERROR =
  "TURSO_DATABASE_URL is not set. Add it to .env.local. Without it, database-backed routes will fail when they try to access the database.";

function getConnectionConfig() {
  const url = process.env.TURSO_DATABASE_URL?.trim() ?? "";
  if (!url) {
    throw new Error(MISSING_DATABASE_URL_ERROR);
  }

  return {
    url,
    authToken: process.env.TURSO_AUTH_TOKEN?.trim(),
  };
}

function createDatabaseClient() {
  const config = getConnectionConfig();
  const client = createClient(config);
  return drizzle(client);
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
