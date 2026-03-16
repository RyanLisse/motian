import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: ".env.local" });

import type { Config } from "drizzle-kit";

export default {
  schema: "./packages/db/src/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url:
      process.env.TURSO_DATABASE_URL ??
      (() => {
        throw new Error("TURSO_DATABASE_URL is not set in .env.local");
      })(),
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
} satisfies Config;
