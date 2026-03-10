import { isDeepStrictEqual } from "node:util";
import type {
  HarnessCompletionRequirement,
  HarnessObservedCompletionSignal,
  HarnessPlanDefinition,
  HarnessRunManifest,
  HarnessTaskDefinition,
} from "../contracts";
import {
  harnessEvaluationPolicySchema,
  harnessObservedCompletionSignalSchema,
  harnessPlanDefinitionSchema,
  harnessRunManifestSchema,
} from "../contracts";
import { buildHarnessWorkflowGraph, getBlockedTaskIds, getReadyTaskIds } from "./graph";

export interface HarnessTaskExecutionState {
  runsByDispatchId?: Record<string, HarnessRunManifest | undefined>;
  signals?: HarnessObservedCompletionSignal[];
}

export interface HarnessDispatchEvaluation {
  dispatchId: string;
  required: boolean;
  status?: HarnessRunManifest["status"];
  present: boolean;
  acceptable: boolean;
  missingArtifacts: string[];
}

export interface HarnessTaskCompletionEvaluation {
  taskId: string;
  complete: boolean;
  blockingReasons: string[];
  dispatches: HarnessDispatchEvaluation[];
  missingRequirements: HarnessCompletionRequirement[];
  satisfiedRequirements: HarnessCompletionRequirement[];
  observedSignals: HarnessObservedCompletionSignal[];
}

export interface HarnessPlanCompletionEvaluation {
  complete: boolean;
  blockedTaskIds: string[];
  readyTaskIds: string[];
  taskEvaluations: Record<string, HarnessTaskCompletionEvaluation>;
}

function collectSignalsFromRun(
  dispatchId: string,
  run: HarnessRunManifest,
): HarnessObservedCompletionSignal[] {
  const observed: HarnessObservedCompletionSignal[] = [];

  if (run.status === "succeeded" || run.status === "failed" || run.status === "timed_out") {
    observed.push({ kind: "dispatch_status", dispatchId, status: run.status });
  }

  for (const event of run.lifecycle) {
    observed.push({ kind: "lifecycle_status", dispatchId, status: event.status });
  }

  for (const artifact of run.artifacts) {
    observed.push({
      kind: "artifact_kind",
      dispatchId,
      artifactKind: artifact.kind,
      path: artifact.relativePath,
    });
  }

  if (run.result) {
    observed.push({
      kind: "result_path",
      dispatchId,
      path: "result.outcome",
      value: run.result.outcome,
    });
    observed.push({
      kind: "result_path",
      dispatchId,
      path: "result.exitCode",
      value: run.result.exitCode ?? undefined,
    });
    observed.push({
      kind: "result_path",
      dispatchId,
      path: "result.timedOut",
      value: run.result.timedOut,
    });
  }

  for (const [key, value] of Object.entries(run.externalContext ?? {})) {
    observed.push({ kind: "external_context", dispatchId, key, value });
  }

  return observed.filter(Boolean) as HarnessObservedCompletionSignal[];
}

function defaultRequirements(task: HarnessTaskDefinition): HarnessCompletionRequirement[] {
  if (!task.evaluation.completion.defaultDispatchSuccess) return [];
  return task.dispatches
    .filter((dispatch) => dispatch.required)
    .map((dispatch) => ({
      kind: "dispatch_status",
      dispatchId: dispatch.id,
      status: "succeeded" as const,
    }));
}

function requirementSatisfied(
  requirement: HarnessCompletionRequirement,
  signals: HarnessObservedCompletionSignal[],
): boolean {
  switch (requirement.kind) {
    case "dispatch_status":
      return signals.some(
        (signal) =>
          signal.kind === "dispatch_status" &&
          signal.dispatchId === requirement.dispatchId &&
          signal.status === requirement.status,
      );
    case "lifecycle_status":
      return signals.some(
        (signal) =>
          signal.kind === "lifecycle_status" &&
          signal.status === requirement.status &&
          (!requirement.dispatchId || signal.dispatchId === requirement.dispatchId),
      );
    case "artifact_kind":
      return (
        signals.filter(
          (signal) =>
            signal.kind === "artifact_kind" &&
            signal.artifactKind === requirement.artifactKind &&
            (!requirement.dispatchId || signal.dispatchId === requirement.dispatchId),
        ).length >= requirement.minCount
      );
    case "result_path":
      return signals.some(
        (signal) =>
          signal.kind === "result_path" &&
          signal.path === requirement.path &&
          (!requirement.dispatchId || signal.dispatchId === requirement.dispatchId) &&
          (requirement.expected === undefined ||
            isDeepStrictEqual(signal.value, requirement.expected)),
      );
    case "external_context":
      return signals.some(
        (signal) =>
          signal.kind === "external_context" &&
          signal.key === requirement.key &&
          (requirement.expected === undefined ||
            isDeepStrictEqual(signal.value, requirement.expected)),
      );
    case "manual_signal":
      return signals.some(
        (signal) => signal.kind === "manual_signal" && signal.signal === requirement.signal,
      );
  }
}

export function evaluateHarnessTaskCompletion(
  task: HarnessTaskDefinition,
  state: HarnessTaskExecutionState = {},
): HarnessTaskCompletionEvaluation {
  const evaluation = harnessEvaluationPolicySchema.parse(task.evaluation);
  const runsByDispatchId = Object.fromEntries(
    Object.entries(state.runsByDispatchId ?? {}).map(([dispatchId, run]) => [
      dispatchId,
      run ? harnessRunManifestSchema.parse(run) : undefined,
    ]),
  );
  const explicitSignals = (state.signals ?? []).map((signal) =>
    harnessObservedCompletionSignalSchema.parse(signal),
  );

  const dispatches: HarnessDispatchEvaluation[] = task.dispatches.map((dispatch) => {
    const run = runsByDispatchId[dispatch.id];
    const artifactKinds = new Set(run?.artifacts.map((artifact) => artifact.kind) ?? []);
    const requiredArtifacts = new Set([
      ...evaluation.requiredArtifacts,
      ...dispatch.requiredArtifacts,
    ]);

    return {
      dispatchId: dispatch.id,
      required: dispatch.required,
      status: run?.status,
      present: Boolean(run),
      acceptable: Boolean(run && evaluation.acceptableRunStatuses.includes(run.status as never)),
      missingArtifacts: Array.from(requiredArtifacts).filter(
        (artifactKind) => !artifactKinds.has(artifactKind),
      ),
    };
  });

  const blockingReasons = dispatches.flatMap((dispatch) => {
    if (!dispatch.required) return [];
    if (!dispatch.present)
      return [`Dispatch '${dispatch.dispatchId}' has not produced a run manifest.`];

    const reasons: string[] = [];
    if (!dispatch.acceptable) {
      reasons.push(
        `Dispatch '${dispatch.dispatchId}' is in unacceptable status '${dispatch.status}'.`,
      );
    }
    if (dispatch.missingArtifacts.length > 0) {
      reasons.push(
        `Dispatch '${dispatch.dispatchId}' is missing artifacts: ${dispatch.missingArtifacts.join(", ")}.`,
      );
    }
    return reasons;
  });

  const availableRuns = Object.values(runsByDispatchId).filter((run): run is HarnessRunManifest =>
    Boolean(run),
  );

  for (const key of evaluation.requiredExternalContextKeys) {
    const hasKey = availableRuns.some((run) => key in (run.externalContext ?? {}));
    if (!hasKey) {
      blockingReasons.push(`Required external context key '${key}' was not observed on any run.`);
    }
  }

  const observedSignals = [
    ...Object.entries(runsByDispatchId).flatMap(([dispatchId, run]) =>
      run ? collectSignalsFromRun(dispatchId, run) : [],
    ),
    ...explicitSignals,
  ];
  const requirements =
    evaluation.completion.requirements.length > 0
      ? evaluation.completion.requirements
      : defaultRequirements(task);
  const satisfiedRequirements = requirements.filter((requirement) =>
    requirementSatisfied(requirement, observedSignals),
  );
  const missingRequirements = requirements.filter(
    (requirement) => !requirementSatisfied(requirement, observedSignals),
  );
  const completionSatisfied =
    requirements.length === 0
      ? blockingReasons.length === 0
      : evaluation.completion.mode === "all"
        ? missingRequirements.length === 0
        : satisfiedRequirements.length > 0;

  return {
    taskId: task.id,
    complete: blockingReasons.length === 0 && completionSatisfied,
    blockingReasons,
    dispatches,
    missingRequirements,
    satisfiedRequirements,
    observedSignals,
  };
}

export function evaluateHarnessPlanCompletion(
  plan: HarnessPlanDefinition,
  taskStates: Record<string, HarnessTaskExecutionState> = {},
): HarnessPlanCompletionEvaluation {
  const normalizedPlan = harnessPlanDefinitionSchema.parse(plan);
  const graph = buildHarnessWorkflowGraph(normalizedPlan);
  const taskEvaluations = Object.fromEntries(
    normalizedPlan.tasks.map((task) => [
      task.id,
      evaluateHarnessTaskCompletion(task, taskStates[task.id]),
    ]),
  );
  const completedTaskIds = Object.values(taskEvaluations)
    .filter((evaluation) => evaluation.complete)
    .map((evaluation) => evaluation.taskId);

  return {
    complete: completedTaskIds.length === normalizedPlan.tasks.length,
    readyTaskIds: getReadyTaskIds(graph, completedTaskIds),
    blockedTaskIds: getBlockedTaskIds(graph, completedTaskIds),
    taskEvaluations,
  };
}
