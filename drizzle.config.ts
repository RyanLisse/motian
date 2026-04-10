import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: ".env.local" });

import type { Config } from "drizzle-kit";

export default {
  schema: [
    "./packages/db/src/schema.ts",
    "./src/db/saved-searches-schema.ts",
    "./src/db/kpi-snapshots-schema.ts",
    "./src/db/platform-status-schema.ts",
  ],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Migrations must use the DIRECT (unpooled) Neon endpoint.
    // PgBouncer transaction mode blocks DDL: SET, CREATE INDEX CONCURRENTLY, etc.
    // Set DATABASE_URL_UNPOOLED to the direct endpoint in .env.local;
    // DATABASE_URL (pooler endpoint) is used at runtime by the app.
    url:
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.DATABASE_URL ??
      (() => {
        throw new Error("DATABASE_URL is not set in .env.local");
      })(),
  },
} satisfies Config;
