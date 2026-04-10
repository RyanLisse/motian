import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const WORKFLOW_DIR = path.join(ROOT, ".github", "workflows");

const NEW_WORKFLOWS = [
  ".github/workflows/ce-review-symphony.yml",
  ".github/workflows/symphony-ci-hooks.yml",
] as const;

const NEW_SCRIPTS = [
  "scripts/harness/pr-comment-writer.ts",
  "scripts/harness/sha-discipline.ts",
  "scripts/harness/auto-resolve-threads.ts",
] as const;

function resolveFromRoot(relativePath: string): string {
  return path.join(ROOT, relativePath);
}

function readText(relativePath: string): string {
  return fs.readFileSync(resolveFromRoot(relativePath), "utf8");
}

function collectWorkflowFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectWorkflowFiles(fullPath));
      continue;
    }

    if (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml")) {
      results.push(fullPath);
    }
  }

  return results;
}

async function assertWorkflowTriggers(
  workflowPath: string,
  expectedOnKeys: string[],
  expectations: Record<string, { types?: string[]; workflows?: string[] }>,
): Promise<void> {
  // Load the YAML parser lazily so Vitest doesn't trip over static package
  // resolution in this workspace.
  const yaml = await import("yaml");
  const parsed = yaml.parse(fs.readFileSync(resolveFromRoot(workflowPath), "utf8")) as {
    on?: Record<string, unknown>;
  };

  expect(parsed.on, `${workflowPath} must define an 'on' trigger block`).toBeDefined();
  expect(Object.keys(parsed.on ?? {}).sort()).toEqual([...expectedOnKeys].sort());

  for (const [triggerName, triggerExpectation] of Object.entries(expectations)) {
    const trigger = parsed.on?.[triggerName] as {
      types?: string[];
      workflows?: string[];
    };

    expect(trigger, `${workflowPath} must include the '${triggerName}' trigger`).toBeDefined();

    if (triggerExpectation.types) {
      expect(trigger.types).toEqual(triggerExpectation.types);
    }

    if (triggerExpectation.workflows) {
      expect(trigger.workflows).toEqual(triggerExpectation.workflows);
    }
  }
}

describe("code factory integration", () => {
  it("includes the new workflow files", () => {
    for (const workflowPath of NEW_WORKFLOWS) {
      expect(
        fs.existsSync(resolveFromRoot(workflowPath)),
        `Expected workflow file to exist: ${workflowPath}`,
      ).toBe(true);
    }
  });

  it("uses the expected triggers in ce-review-symphony.yml", () => {
    return assertWorkflowTriggers(".github/workflows/ce-review-symphony.yml", ["pull_request"], {
      pull_request: {
        types: ["opened", "synchronize", "ready_for_review"],
      },
    });
  });

  it("uses the expected triggers in symphony-ci-hooks.yml", () => {
    return assertWorkflowTriggers(
      ".github/workflows/symphony-ci-hooks.yml",
      ["pull_request", "workflow_run"],
      {
        pull_request: {
          types: ["synchronize"],
        },
        workflow_run: {
          workflows: ["CI"],
          types: ["completed"],
        },
      },
    );
  });

  it("includes the new harness scripts", () => {
    for (const scriptPath of NEW_SCRIPTS) {
      expect(
        fs.existsSync(resolveFromRoot(scriptPath)),
        `Expected harness script to exist: ${scriptPath}`,
      ).toBe(true);
    }
  });

  it("keeps hasUiFiles in risk-policy-gate.ts", () => {
    expect(readText("scripts/harness/risk-policy-gate.ts")).toContain("hasUiFiles");
  });

  it("documents the terminal failure policy in WORKFLOW.md", () => {
    expect(readText("WORKFLOW.md")).toContain("Terminal failure policy");
  });

  it("requires HTML comment markers in workflow files that create PR comments", () => {
    const workflowFiles = collectWorkflowFiles(WORKFLOW_DIR);
    const violations: string[] = [];

    // Only check workflows that actually create/update PR comments via API
    const commentCreationPatterns = [
      "issues.createComment",
      "issues.updateComment",
      "issues/comments",
      "createComment",
      "upsertPrComment",
    ];

    for (const filePath of workflowFiles) {
      const source = fs.readFileSync(filePath, "utf8");
      const createsComments = commentCreationPatterns.some((p) => source.includes(p));

      if (!createsComments) continue;

      if (!/<!--[\s\S]*?-->/.test(source)) {
        violations.push(path.relative(ROOT, filePath));
      }
    }

    expect(
      violations,
      `Workflow files that create PR comments must contain an HTML comment marker:\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});
