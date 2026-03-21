import path from "node:path";
import { defineConfig } from "vitest/config";

process.env.TURSO_DATABASE_URL ??= "file::memory:";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    reporters: ["verbose"],
    // Parallel test execution for faster CI (40-60% speedup)
    // - threads: Better for CPU-bound tests (our case: DB mocks, business logic)
    // - forks: Use if tests have memory leaks or need full process isolation
    pool: "forks",
    poolOptions: {
      forks: {
        isolate: true,
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "json-summary"],
      reportsDirectory: "./coverage",
      exclude: [
        "node_modules/",
        "tests/",
        "**/*.test.ts",
        "**/*.config.*",
        "harness-evidence/",
        ".next/",
        "**/.next/**",
      ],
      // Gate: fail if coverage drops below minimum (raise over time)
      thresholds: {
        statements: 1,
        branches: 1,
        functions: 1,
        lines: 1,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
