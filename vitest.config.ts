import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
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
      ],
      // Optional: enable threshold later, e.g. { statements: 40, branches: 35 }
      // threshold: { statements: 0, branches: 0, functions: 0, lines: 0 },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
