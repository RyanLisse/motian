import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  defaultHarnessConfig,
  loadHarnessConfig,
  resolveHarnessConfigPath,
} from "@/src/harness/config";

describe("harness config loader", () => {
  it("loads the repository harness config through the shared schema", () => {
    const config = loadHarnessConfig({ cwd: process.cwd() });

    expect(config.version).toBe("1");
    expect(config.riskTierRules.low).toContain("**");
    expect(config.mergePolicy.high.requiredChecks).toContain("browser-evidence");
  });

  it("returns defaults when the config file is intentionally missing", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "motian-harness-config-missing-"));

    try {
      const config = loadHarnessConfig({ allowMissing: true, cwd: tempRoot });
      expect(resolveHarnessConfigPath(tempRoot)).toBe(join(tempRoot, "harness.config.json"));
      expect(config).toEqual(defaultHarnessConfig);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("fills defaults for omitted optional config sections", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "motian-harness-config-partial-"));

    try {
      mkdirSync(tempRoot, { recursive: true });
      writeFileSync(
        join(tempRoot, "harness.config.json"),
        JSON.stringify(
          {
            riskTierRules: {
              high: ["src/db/**"],
              medium: ["src/services/**"],
              low: ["**"],
            },
            mergePolicy: {
              high: { requiredChecks: ["risk-policy-gate"] },
              medium: { requiredChecks: ["lint"] },
              low: { requiredChecks: ["lint"] },
            },
          },
          null,
          2,
        ),
        "utf8",
      );

      const config = loadHarnessConfig({ cwd: tempRoot });
      expect(config.docsDriftRules.message).toBe(defaultHarnessConfig.docsDriftRules.message);
      expect(config.harnessGap.labelPrefix).toBe("harness-gap");
      expect(config.mergePolicy.high.requireCodeReview).toBe(false);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
