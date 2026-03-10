import { describe, expect, it } from "vitest";
import {
  buildHarnessWorkflowGraph,
  getReadyDispatchIds,
  getReadyTaskIds,
  validateHarnessPlanDefinition,
  validateHarnessPlanDocument,
} from "@/src/harness/workflow";

const validPlan = {
  version: "1",
  id: "candidate-harness",
  title: "Candidate harness",
  tasks: [
    {
      id: "validate-plan",
      title: "Validate the plan",
      acceptanceCriteria: ["Plan schema passes"],
      dispatches: [{ id: "dispatch-validate", dispatch: "harness:validate-plan" }],
    },
    {
      id: "run-smoke",
      title: "Run smoke suite",
      dependsOn: ["validate-plan"],
      acceptanceCriteria: ["Smoke suite passes"],
      dispatches: [
        {
          id: "dispatch-smoke",
          dispatch: "harness:smoke",
          dependsOnDispatches: ["dispatch-validate"],
          requiredArtifacts: ["stdout"],
        },
      ],
      evaluation: {
        completion: {
          requirements: [
            { kind: "dispatch_status", dispatchId: "dispatch-smoke", status: "succeeded" },
            { kind: "artifact_kind", dispatchId: "dispatch-smoke", artifactKind: "stdout" },
          ],
        },
      },
    },
  ],
} as const;

describe("harness workflow validation", () => {
  it("validates plan structure and produces ready task/dispatch views", () => {
    const result = validateHarnessPlanDefinition(validPlan);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.plan).toBeDefined();

    const graph = buildHarnessWorkflowGraph(result.plan as typeof validPlan);
    expect(graph.taskOrder).toEqual(["validate-plan", "run-smoke"]);
    expect(getReadyTaskIds(graph, [])).toEqual(["validate-plan"]);
    expect(getReadyDispatchIds(graph, [], [])).toEqual(["dispatch-validate"]);
    expect(getReadyDispatchIds(graph, ["validate-plan"], ["dispatch-validate"])).toEqual([
      "dispatch-smoke",
    ]);
  });

  it("rejects unknown dependencies and cycles", () => {
    const result = validateHarnessPlanDefinition({
      ...validPlan,
      tasks: [
        {
          id: "alpha",
          title: "Alpha",
          dependsOn: ["beta"],
          dispatches: [{ id: "dispatch-alpha", dispatch: "harness:alpha" }],
        },
        {
          id: "beta",
          title: "Beta",
          dependsOn: ["alpha"],
          dispatches: [
            {
              id: "dispatch-beta",
              dispatch: "harness:beta",
              dependsOnDispatches: ["dispatch-missing"],
            },
          ],
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["unknown_dispatch_dependency", "task_cycle"]),
    );
  });

  it("requires substantive document content beyond section headings", () => {
    const emptyDocument = validateHarnessPlanDocument(
      ["# Harness Plan", "", "## Proposed Changes", "", "## Verification Plan", ""].join("\n"),
    );

    expect(emptyDocument.ok).toBe(false);
    expect(emptyDocument.issues.map((issue) => issue.code)).toContain("empty_required_section");

    const substantiveDocument = validateHarnessPlanDocument(
      [
        "# Harness Plan",
        "",
        "## Proposed Changes",
        "- Add shared contracts",
        "- Validate dependency graph",
        "",
        "## Verification Plan",
        "- Run `pnpm exec vitest run tests/harness/workflow-validation.test.ts`",
      ].join("\n"),
    );

    expect(substantiveDocument.ok).toBe(true);
  });
});
