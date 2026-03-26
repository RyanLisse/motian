import path from "node:path";
import { defineConfig } from "vitest/config";

process.env.TURSO_DATABASE_URL ??= "file::memory:";
const coverageThreshold = Number(process.env.COVERAGE_THRESHOLD ?? "24");
const normalizedCoverageThreshold = Number.isFinite(coverageThreshold)
  ? Math.min(Math.max(Math.trunc(coverageThreshold), 1), 100)
  : 25;

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    reporters: ["verbose"],
    pool: "threads",
    testTimeout: 30_000,
    hookTimeout: 30_000,
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
        statements: normalizedCoverageThreshold,
        branches: Math.max(1, Math.min(100, Math.floor(normalizedCoverageThreshold * 0.8))),
        functions: normalizedCoverageThreshold,
        lines: normalizedCoverageThreshold,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
