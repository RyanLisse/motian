import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd());

/**
 * R21 — every high/critical prod advisory must be an override target or a
 * residual ledger row (WP8b). This test locks the ledger format and the
 * known residual ID; a full live `pnpm audit` is too slow for the default suite.
 */
describe("dependency residuals ledger (WP8b)", () => {
  const ledgerPath = join(ROOT, "docs/security/dependency-residuals.md");
  const packageJsonPath = join(ROOT, "package.json");

  it("ledger exists and names the sharp residual with revisit metadata", () => {
    const ledger = readFileSync(ledgerPath, "utf8");
    expect(ledger).toMatch(/GHSA-f88m-g3jw-g9cj/);
    expect(ledger).toMatch(/GHSA-45rx-2jwx-cxfr/);
    expect(ledger).toMatch(/sharp/);
    expect(ledger).toMatch(/propagator-jaeger|opentelemetry/i);
    expect(ledger).toMatch(/Revisit|2026-08-27/);
    expect(ledger).toMatch(/Compensating control|compensating/i);
  });

  it("package.json pnpm.overrides covers the remediations named in the ledger", () => {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      pnpm?: { overrides?: Record<string, string> };
    };
    const overrides = pkg.pnpm?.overrides ?? {};
    const keys = Object.keys(overrides).join(" ");

    expect(keys).toMatch(/brace-expansion/);
    expect(keys).toMatch(/shell-quote/);
    expect(keys).toMatch(/protobufjs/);
    expect(keys).toMatch(/postcss/);
    expect(keys).toMatch(/undici/);
    expect(keys).toMatch(/adm-zip/);
    expect(keys).toMatch(/tar/);
  });

  it("pnpm-lock.yaml records overrides (honored by pnpm 9.15)", () => {
    const lock = readFileSync(join(ROOT, "pnpm-lock.yaml"), "utf8");
    expect(lock).toMatch(/^overrides:/m);
    expect(lock).toMatch(/brace-expansion/);
    expect(lock).toMatch(/adm-zip/);
  });
});
