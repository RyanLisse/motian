import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd());

/**
 * AE8 — CI must not override coverage thresholds; the committed floor in
 * vitest.config.ts is the only floor (R18 / PD3).
 */
describe("CI coverage gate (AE8)", () => {
  it("ci.yml does not pass --coverage.thresholds overrides", () => {
    const ciYml = readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8");
    expect(ciYml).not.toMatch(/--coverage\.thresholds/);
    expect(ciYml).not.toMatch(/COVERAGE_THRESHOLD\s*=/);
  });

  it("vitest.config.ts commits four independent numeric floors", () => {
    const configSource = readFileSync(join(ROOT, "vitest.config.ts"), "utf8");

    expect(configSource).toMatch(/statements:\s*30/);
    expect(configSource).toMatch(/lines:\s*30/);
    expect(configSource).toMatch(/functions:\s*50/);
    expect(configSource).toMatch(/branches:\s*60/);

    // No derived-branch formula (e.g. statements * 0.8)
    expect(configSource).not.toMatch(/\*\s*0\.8/);
    expect(configSource).not.toMatch(/COVERAGE_THRESHOLD/);
    expect(configSource).not.toMatch(/normalizedCoverageThreshold/);
  });
});
