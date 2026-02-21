import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: 10, // Neon free tier: max 10 connections
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: { rejectUnauthorized: false },
});

// Prevent silent crashes on dropped connections
pool.on("error", (err) => {
  console.error("Onverwachte pool fout:", err.message);
});

export const db = drizzle(pool);
export * from "./schema";
