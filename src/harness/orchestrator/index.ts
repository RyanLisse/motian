import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type {
  HarnessArtifact,
  HarnessCommandDescriptor,
  HarnessExternalContextValue,
  HarnessLifecycleEvent,
  HarnessRunManifest,
  HarnessRunStatus,
} from "../contracts/run";
import { harnessRunManifestSchema } from "../contracts/run";
import { executeHarnessCommand, type HarnessProcessOutcome } from "../runtime";
import {
  prepareHarnessWorkspace,
  resolveGitRepoRoot,
  sanitizeHarnessRunIdSegment,
} from "../workspace";

// Re-export shared run types from contracts
export type {
  HarnessArtifact,
  HarnessCommandDescriptor,
  HarnessLifecycleEvent,
  HarnessRunManifest,
  HarnessRunStatus,
} from "../contracts/run";

export interface HarnessOrchestratorHooks {
  onLifecycleEvent?: (
    manifest: HarnessRunManifest,
    event: HarnessLifecycleEvent,
  ) => Promise<void> | void;
  onManifestUpdated?: (manifest: HarnessRunManifest) => Promise<void> | void;
}

export interface HarnessDispatchRequest {
  dispatch: string;
  command?: string;
  args?: string[];
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
  repoRoot?: string;
  baseRef?: string;
  runId?: string;
  runRoot?: string;
  workspaceRoot?: string;
  externalContext?: Record<string, HarnessExternalContextValue | undefined>;
  hooks?: HarnessOrchestratorHooks;
}

const DEFAULT_TIMEOUT_MS = 15 * 60_000;
const FINAL_STATUSES: HarnessRunStatus[] = ["succeeded", "failed", "timed_out"];

function resolveCommandDescriptor(request: HarnessDispatchRequest): HarnessCommandDescriptor {
  return {
    executable: request.command ?? "pnpm",
    args: request.command ? (request.args ?? []) : [request.dispatch, ...(request.args ?? [])],
    timeoutMs: request.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    source: request.command ? "explicit" : "dispatch-script",
    envKeys: Object.keys(request.env ?? {}).sort(),
  };
}

function toFinalStatus(outcome: HarnessProcessOutcome): HarnessRunStatus {
  switch (outcome) {
    case "succeeded":
      return "succeeded";
    case "timed_out":
      return "timed_out";
    default:
      return "failed";
  }
}

function manifestPathFor(runRoot: string): string {
  return join(runRoot, "manifest.json");
}

function artifactSize(path: string): number | undefined {
  return existsSync(path) ? statSync(path).size : undefined;
}

function buildArtifacts(manifest: HarnessRunManifest): HarnessArtifact[] {
  const manifestPath = manifest.integration.manifestPath;
  const artifacts: HarnessArtifact[] = [
    {
      kind: "manifest",
      path: manifestPath,
      relativePath: relative(manifest.repoRoot, manifestPath),
      description: "Manifest met runstatus en uitvoeringsgegevens",
      sizeBytes: artifactSize(manifestPath),
    },
  ];

  if (manifest.result) {
    artifacts.push(
      {
        kind: "stdout",
        path: manifest.result.stdoutPath,
        relativePath: relative(manifest.repoRoot, manifest.result.stdoutPath),
        description: "Vastgelegde standaarduitvoer van het proces",
        sizeBytes: artifactSize(manifest.result.stdoutPath),
      },
      {
        kind: "stderr",
        path: manifest.result.stderrPath,
        relativePath: relative(manifest.repoRoot, manifest.result.stderrPath),
        description: "Vastgelegde foutuitvoer van het proces",
        sizeBytes: artifactSize(manifest.result.stderrPath),
      },
    );
  }

  if (manifest.workspace) {
    artifacts.push({
      kind: "workspace",
      path: manifest.workspace.root,
      relativePath: relative(manifest.repoRoot, manifest.workspace.root),
      description: "Geïsoleerde git-worktree voor deze harness-run",
    });
  }

  return artifacts;
}

async function writeManifest(
  manifest: HarnessRunManifest,
  hooks?: HarnessOrchestratorHooks,
): Promise<void> {
  manifest.artifacts = buildArtifacts(manifest);
  writeFileSync(manifest.integration.manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  if (manifest.artifacts[0]?.kind === "manifest") {
    manifest.artifacts[0].sizeBytes = artifactSize(manifest.integration.manifestPath);
  }
  writeFileSync(manifest.integration.manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  await hooks?.onManifestUpdated?.(manifest);
}

async function transitionManifest(
  manifest: HarnessRunManifest,
  status: HarnessRunStatus,
  detail: string,
  hooks?: HarnessOrchestratorHooks,
): Promise<void> {
  const now = new Date().toISOString();
  manifest.status = status;
  manifest.updatedAt = now;

  if (status === "running" && !manifest.startedAt) {
    manifest.startedAt = now;
  }

  if (FINAL_STATUSES.includes(status)) {
    manifest.finishedAt = now;
  }

  const event: HarnessLifecycleEvent = { status, at: now, detail };
  manifest.lifecycle.push(event);
  await writeManifest(manifest, hooks);
  await hooks?.onLifecycleEvent?.(manifest, event);
}

export async function orchestrateHarnessRun(
  request: HarnessDispatchRequest,
): Promise<HarnessRunManifest> {
  const repoRoot = resolveGitRepoRoot(request.repoRoot ?? process.cwd());
  const runId = request.runId ?? randomUUID();
  const sanitizedRunId = sanitizeHarnessRunIdSegment(runId);
  const runRoot = resolve(request.runRoot ?? join(repoRoot, ".harness", "runs", sanitizedRunId));
  const command = resolveCommandDescriptor(request);
  const createdAt = new Date().toISOString();

  mkdirSync(runRoot, { recursive: true });

  // Filter out undefined values from externalContext to match contract
  const externalContext = request.externalContext
    ? Object.fromEntries(
        Object.entries(request.externalContext).filter(([, value]) => value !== undefined) as Array<
          [string, HarnessExternalContextValue]
        >,
      )
    : undefined;

  const manifest: HarnessRunManifest = {
    version: "1",
    runId,
    dispatch: request.dispatch,
    status: "queued",
    repoRoot,
    runRoot,
    createdAt,
    updatedAt: createdAt,
    command,
    lifecycle: [],
    artifacts: [],
    externalContext,
    integration: {
      manifestPath: manifestPathFor(runRoot),
      resumeToken: runId,
    },
  };

  await transitionManifest(
    manifest,
    "queued",
    `Dispatch "${request.dispatch}" is geaccepteerd voor uitvoering`,
    request.hooks,
  );

  try {
    await transitionManifest(
      manifest,
      "preparing_workspace",
      `Geïsoleerde worktree wordt voorbereid vanaf ${request.baseRef ?? "HEAD"}`,
      request.hooks,
    );

    const workspace = prepareHarnessWorkspace({
      repoRoot,
      runId,
      baseRef: request.baseRef,
      runRoot,
      workspaceRoot: request.workspaceRoot,
    });

    manifest.workspace = {
      isolation: workspace.isolation,
      root: workspace.workspaceRoot,
      baseRef: workspace.baseRef,
      created: workspace.created,
    };

    await transitionManifest(
      manifest,
      "workspace_ready",
      `Werkruimte is klaar op ${workspace.workspaceRoot}`,
      request.hooks,
    );

    await transitionManifest(
      manifest,
      "running",
      `Uitvoering gestart: ${command.executable} ${command.args.join(" ")}`,
      request.hooks,
    );

    const result = await executeHarnessCommand({
      command: command.executable,
      args: command.args,
      cwd: workspace.workspaceRoot,
      env: {
        ...request.env,
        HARNESS_RUN_ID: manifest.runId,
        HARNESS_DISPATCH: manifest.dispatch,
        HARNESS_RUN_ROOT: manifest.runRoot,
        HARNESS_WORKSPACE_ROOT: workspace.workspaceRoot,
      },
      timeoutMs: command.timeoutMs,
      stdoutPath: join(workspace.logsDir, "stdout.log"),
      stderrPath: join(workspace.logsDir, "stderr.log"),
    });

    manifest.result = result;
    await transitionManifest(
      manifest,
      toFinalStatus(result.outcome),
      `Uitvoering ${result.outcome} na ${result.durationMs}ms`,
      request.hooks,
    );
    return manifest;
  } catch (error) {
    manifest.error = error instanceof Error ? error.message : String(error);
    await transitionManifest(manifest, "failed", manifest.error, request.hooks);
    return manifest;
  }
}

export function readHarnessRunManifest(
  pathOrRunId: string,
  repoRoot = process.cwd(),
): HarnessRunManifest {
  const sanitizedRunId = sanitizeHarnessRunIdSegment(pathOrRunId);
  const manifestPath = pathOrRunId.endsWith(".json")
    ? resolve(pathOrRunId)
    : join(resolveGitRepoRoot(repoRoot), ".harness", "runs", sanitizedRunId, "manifest.json");

  try {
    const parsedJson = JSON.parse(readFileSync(manifestPath, "utf8"));
    return harnessRunManifestSchema.parse(parsedJson);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[Harness Orchestrator] Ongeldig run-manifest op ${manifestPath}: ${message}`);
  }
}

export function formatHarnessRunSummary(manifest: HarnessRunManifest): string {
  const summary = [
    `[Harness Orchestrator] Runoverzicht ${manifest.runId}`,
    `  dispatch   : ${manifest.dispatch}`,
    `  status     : ${manifest.status}`,
    `  manifest   : ${manifest.integration.manifestPath}`,
  ];

  if (manifest.workspace) {
    summary.push(`  werkruimte: ${manifest.workspace.root}`);
  }

  if (manifest.result) {
    summary.push(`  opdracht  : ${manifest.result.commandLine}`);
    summary.push(`  duur      : ${manifest.result.durationMs}ms`);
  }

  if (manifest.error) {
    summary.push(`  fout      : ${manifest.error}`);
  }

  return summary.join("\n");
}
