import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadHarnessConfig } from "@/src/harness/config";
import { validateHarnessPlanDocument } from "@/src/harness/workflow/validation";

function createHarnessRepo(root: string): string {
  mkdirSync(root, { recursive: true });
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "harness@example.com"], {
    cwd: root,
    stdio: "ignore",
  });
  execFileSync("git", ["config", "user.name", "Harness Test"], {
    cwd: root,
    stdio: "ignore",
  });

  writeFileSync(
    join(root, "harness.config.json"),
    readFileSync(join(process.cwd(), "harness.config.json"), "utf8"),
    "utf8",
  );
  execFileSync("git", ["add", "harness.config.json"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "init"], { cwd: root, stdio: "ignore" });
  return root;
}

describe("harness integration", () => {
  describe("validate-plan script integration", () => {
    it("validates plan documents using shared validator", () => {
      const validPlan = [
        "# Test Plan",
        "",
        "## Proposed Changes",
        "- Add feature X",
        "- Update component Y",
        "",
        "## Verification Plan",
        "- Run `pnpm test`",
        "- Check output",
      ].join("\n");

      const result = validateHarnessPlanDocument(validPlan);
      expect(result.ok).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it("detects missing sections", () => {
      const invalidPlan = ["# Test Plan", "", "## Proposed Changes", "- Add feature"].join("\n");

      const result = validateHarnessPlanDocument(invalidPlan);
      expect(result.ok).toBe(false);
      expect(result.issues.some((issue) => issue.code === "empty_required_section")).toBe(true);
    });

    it("detects empty sections", () => {
      const emptyPlan = [
        "# Test Plan",
        "",
        "## Proposed Changes",
        "",
        "## Verification Plan",
        "",
      ].join("\n");

      const result = validateHarnessPlanDocument(emptyPlan);
      expect(result.ok).toBe(false);
      expect(result.issues.filter((issue) => issue.code === "empty_required_section")).toHaveLength(
        2,
      );
    });
  });

  describe("risk-policy-gate script integration", () => {
    it("loads harness config using shared loader", () => {
      const config = loadHarnessConfig({ cwd: process.cwd() });

      expect(config.version).toBe("1");
      expect(config.riskTierRules).toBeDefined();
      expect(config.mergePolicy).toBeDefined();
      expect(config.docsDriftRules).toBeDefined();
    });

    it("config has expected risk tier structure", () => {
      const config = loadHarnessConfig({ cwd: process.cwd() });

      expect(config.riskTierRules.high).toBeInstanceOf(Array);
      expect(config.riskTierRules.medium).toBeInstanceOf(Array);
      expect(config.riskTierRules.low).toBeInstanceOf(Array);
    });

    it("config has expected merge policy structure", () => {
      const config = loadHarnessConfig({ cwd: process.cwd() });

      for (const tier of ["high", "medium", "low"] as const) {
        expect(config.mergePolicy[tier].requiredChecks).toBeInstanceOf(Array);
        expect(typeof config.mergePolicy[tier].requireCodeReview).toBe("boolean");
      }
    });

    it("emits JSON when there are no changed files", () => {
      const tempRoot = mkdtempSync(join(tmpdir(), "motian-risk-policy-gate-empty-"));

      try {
        const repoRoot = createHarnessRepo(join(tempRoot, "repo"));
        const scriptPath = join(process.cwd(), "scripts/harness/risk-policy-gate.ts");

        const output = execFileSync("pnpm", ["tsx", scriptPath, "--json", "--cwd", repoRoot], {
          cwd: process.cwd(),
          encoding: "utf8",
        });

        const parsed = JSON.parse(output) as {
          tier: string;
          requiredChecks: string[];
          docsDriftPass: boolean;
          totalFiles: number;
        };

        expect(parsed.tier).toBe("low");
        expect(parsed.requiredChecks).toEqual(["risk-policy-gate", "lint"]);
        expect(parsed.docsDriftPass).toBe(true);
        expect(parsed.totalFiles).toBe(0);
      } finally {
        rmSync(tempRoot, { recursive: true, force: true });
      }
    });
  });

  describe("type sharing between core/orchestrator/adapter", () => {
    it("adapter types import from contracts", async () => {
      // This test verifies the import structure is correct
      const { GitHubProjectsAdapterImpl } = await import("@/src/harness/adapters/github/adapter");
      expect(GitHubProjectsAdapterImpl).toBeDefined();
    });

    it("core contract and orchestrator modules blijven importeerbaar", async () => {
      const orchestratorModule = await import("@/src/harness/orchestrator");
      const contractsModule = await import("@/src/harness/contracts/run");

      // Verifieer dat beide modules nog geladen kunnen worden.
      expect(orchestratorModule).toBeDefined();
      expect(contractsModule).toBeDefined();
    });
  });
});
