import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..");

function readSource(file: string): string {
  return readFileSync(resolve(ROOT, file), "utf-8");
}

describe("t3-env schema coverage", () => {
  it("src/env.ts declares DATABASE_URL as required (not optional)", () => {
    const envSource = readSource("src/env.ts");
    // DATABASE_URL should be z.string().url() without .optional()
    expect(envSource).toMatch(/DATABASE_URL:\s*z\.string\(\)\.url\(\)/);
    expect(envSource).not.toMatch(/DATABASE_URL:\s*z\.string\(\)\.url\(\)\.optional\(\)/);
  });

  it("src/env.ts covers all Trigger.dev-synced env vars", () => {
    const triggerSource = readSource("trigger.config.ts");
    const envSource = readSource("src/env.ts");

    // Extract the syncEnvVars block first, then parse env var names from it
    const syncBlockMatch = triggerSource.match(
      /syncEnvVars\([\s\S]*?const keys\s*=\s*\[([\s\S]*?)\]/,
    );
    expect(
      syncBlockMatch,
      "Could not find syncEnvVars keys array in trigger.config.ts",
    ).toBeTruthy();
    const keysBlock = syncBlockMatch?.[1];
    const syncedVars = [...keysBlock.matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]);
    const triggerEnvVars = syncedVars.filter((v) => v !== "DATABASE_URL" && v.length > 3);

    for (const varName of triggerEnvVars) {
      expect(envSource, `Missing ${varName} in src/env.ts schema`).toContain(`${varName}:`);
    }
  });

  it("next.config.ts imports src/env for build-time validation", () => {
    const nextConfig = readSource("next.config.ts");
    expect(nextConfig).toMatch(/import\s+["']\.\/src\/env["']/);
  });

  it("src/env.ts has skipValidation support for CI builds", () => {
    const envSource = readSource("src/env.ts");
    expect(envSource).toContain("skipValidation");
    expect(envSource).toContain("SKIP_ENV_VALIDATION");
  });
});
