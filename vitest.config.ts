import path from "node:path";
import { defineConfig } from "vitest/config";

// Provide a fallback DATABASE_URL so unit tests can initialise the Drizzle client
// without a real database connection.
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/motian_test";

/** Committed coverage floor (PD3). Independent metrics — do not derive one from another. */
export const COVERAGE_FLOORS = {
  statements: 30,
  lines: 30,
  functions: 50,
  branches: 60,
} as const;

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    reporters: ["verbose"],
    pool: "forks",
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "json-summary"],
      reportsDirectory: "./coverage",
      // Scoped to first-party source so the v8 provider doesn't instrument the
      // whole dependency graph — without this, `pnpm test:coverage` OOMs.
      include: ["app/**", "components/**", "src/**", "packages/*/src/**", "trigger/**"],
      exclude: [
        "node_modules/",
        "tests/",
        "**/*.test.ts",
        "**/*.config.*",
        "harness-evidence/",
        ".next/",
        "**/.next/**",
      ],
      // Gate: fail if coverage drops below committed floor (raise over time)
      thresholds: { ...COVERAGE_FLOORS },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
