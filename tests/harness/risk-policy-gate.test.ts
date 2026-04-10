import { describe, expect, it } from "vitest";
import { loadHarnessConfig } from "@/src/harness/config";
import { evaluateRiskPolicyGate } from "../../scripts/harness/risk-policy-gate";

const repoHarnessConfig = loadHarnessConfig({ cwd: process.cwd() });

describe("risk policy gate", () => {
  it("passes low-risk changes when required checks are already green", async () => {
    const result = await evaluateRiskPolicyGate(
      {
        changedFiles: ["README.md"],
        checkResults: new Map([["lint", "passed"]]),
        cwd: process.cwd(),
        json: false,
        noExecuteChecks: true,
        verbose: false,
      },
      repoHarnessConfig,
    );

    expect(result.tier).toBe("low");
    expect(result.requiredChecks).toEqual(["risk-policy-gate", "lint"]);
    expect(result.passed).toBe(true);
    expect(result.missingRequiredChecks).toEqual([]);
    expect(result.failedRequiredChecks).toEqual([]);
    expect(result.checkResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "lint", required: true, status: "passed" }),
        expect.objectContaining({
          name: "risk-policy-gate",
          required: true,
          status: "passed",
        }),
      ]),
    );
  });

  it("fails high-risk changes without browser evidence and marks code review required", async () => {
    const result = await evaluateRiskPolicyGate(
      {
        changedFiles: ["src/db/schema.ts"],
        checkResults: new Map([
          ["lint", "passed"],
          ["typecheck", "passed"],
          ["test", "passed"],
        ]),
        cwd: process.cwd(),
        json: false,
        noExecuteChecks: true,
        verbose: false,
      },
      repoHarnessConfig,
    );

    expect(result.tier).toBe("high");
    expect(result.requireCodeReview).toBe(true);
    expect(result.passed).toBe(false);
    expect(result.missingRequiredChecks).toEqual(["browser-evidence"]);
    expect(result.failedRequiredChecks).toContain("risk-policy-gate");
    expect(result.checkResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "browser-evidence",
          required: true,
          status: "missing",
        }),
        expect.objectContaining({
          name: "risk-policy-gate",
          required: true,
          status: "failed",
        }),
      ]),
    );
  });
});
