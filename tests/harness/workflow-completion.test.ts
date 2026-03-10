import { describe, expect, it } from "vitest";
import {
  evaluateHarnessPlanCompletion,
  evaluateHarnessTaskCompletion,
} from "@/src/harness/workflow";

const completionPlan = {
  version: "1",
  id: "completion-plan",
  title: "Completion plan",
  tasks: [
    {
      id: "collect-evidence",
      title: "Collect evidence",
      dispatches: [
        {
          id: "dispatch-collect",
          dispatch: "harness:smoke",
          requiredArtifacts: ["stdout"],
        },
      ],
      evaluation: {
        requiredExternalContextKeys: ["issueNumber"],
        completion: {
          requirements: [
            { kind: "dispatch_status", dispatchId: "dispatch-collect", status: "succeeded" },
            { kind: "manual_signal", signal: "qa-approved" },
          ],
        },
      },
    },
    {
      id: "publish-result",
      title: "Publish result",
      dependsOn: ["collect-evidence"],
      dispatches: [{ id: "dispatch-publish", dispatch: "harness:publish" }],
    },
  ],
} as const;

const succeededRun = {
  version: "1",
  runId: "run-123",
  dispatch: "harness:smoke",
  status: "succeeded",
  repoRoot: "/repo",
  runRoot: "/repo/.harness/runs/run-123",
  createdAt: "2026-03-10T12:00:00Z",
  updatedAt: "2026-03-10T12:01:00Z",
  startedAt: "2026-03-10T12:00:05Z",
  finishedAt: "2026-03-10T12:01:00Z",
  command: {
    executable: "pnpm",
    args: ["harness:smoke"],
    timeoutMs: 1000,
    source: "dispatch-script",
    envKeys: ["HARNESS_RUN_ID"],
  },
  lifecycle: [
    { status: "queued", at: "2026-03-10T12:00:00Z", detail: "queued" },
    { status: "running", at: "2026-03-10T12:00:05Z", detail: "running" },
    { status: "succeeded", at: "2026-03-10T12:01:00Z", detail: "done" },
  ],
  artifacts: [
    {
      kind: "manifest",
      path: "/repo/.harness/runs/run-123/manifest.json",
      relativePath: ".harness/runs/run-123/manifest.json",
      description: "manifest",
    },
    {
      kind: "stdout",
      path: "/repo/.harness/runs/run-123/logs/stdout.log",
      relativePath: ".harness/runs/run-123/logs/stdout.log",
      description: "stdout",
    },
  ],
  result: {
    outcome: "succeeded",
    exitCode: 0,
    signal: null,
    pid: 123,
    timedOut: false,
    startedAt: "2026-03-10T12:00:05Z",
    finishedAt: "2026-03-10T12:01:00Z",
    durationMs: 55000,
    stdoutPath: "/repo/.harness/runs/run-123/logs/stdout.log",
    stderrPath: "/repo/.harness/runs/run-123/logs/stderr.log",
    stdoutTail: "all green",
    stderrTail: "",
    commandLine: "pnpm harness:smoke",
  },
  externalContext: {
    issueNumber: 42,
  },
  integration: {
    manifestPath: "/repo/.harness/runs/run-123/manifest.json",
    resumeToken: "run-123",
  },
} as const;

describe("harness workflow completion policy", () => {
  it("requires explicit manual completion signals when configured", () => {
    const task = completionPlan.tasks[0];

    const incomplete = evaluateHarnessTaskCompletion(task, {
      runsByDispatchId: { "dispatch-collect": succeededRun },
    });
    expect(incomplete.complete).toBe(false);
    expect(incomplete.missingRequirements).toEqual(
      expect.arrayContaining([{ kind: "manual_signal", signal: "qa-approved" }]),
    );

    const complete = evaluateHarnessTaskCompletion(task, {
      runsByDispatchId: { "dispatch-collect": succeededRun },
      signals: [{ kind: "manual_signal", signal: "qa-approved", acknowledgedBy: "qa-bot" }],
    });
    expect(complete.complete).toBe(true);
  });

  it("reports ready and blocked tasks from dependency-aware plan completion", () => {
    const result = evaluateHarnessPlanCompletion(completionPlan, {
      "collect-evidence": {
        runsByDispatchId: { "dispatch-collect": succeededRun },
        signals: [{ kind: "manual_signal", signal: "qa-approved", acknowledgedBy: "qa-bot" }],
      },
    });

    expect(result.complete).toBe(false);
    expect(result.readyTaskIds).toEqual(["publish-result"]);
    expect(result.blockedTaskIds).toEqual([]);
    expect(result.taskEvaluations["collect-evidence"]?.complete).toBe(true);
    expect(result.taskEvaluations["publish-result"]?.complete).toBe(false);
  });
});
