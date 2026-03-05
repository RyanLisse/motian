import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "",
  max: 20,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 10_000,
  ssl: { rejectUnauthorized: false },
});

// Prevent silent crashes on dropped connections
pool.on("error", (err) => {
  console.error("Onverwachte pool fout:", err.message);
});

export const db = drizzle(pool);
export * from "./schema";
