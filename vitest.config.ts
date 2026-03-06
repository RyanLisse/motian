import path from "node:path";
import { defineConfig } from "vitest/config";

process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@127.0.0.1:5432/motian_test?sslmode=disable";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    reporters: ["verbose"],
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
