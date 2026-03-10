import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

export interface PrepareHarnessWorkspaceOptions {
  repoRoot: string;
  runId: string;
  baseRef?: string;
  runRoot?: string;
  workspaceRoot?: string;
}

export interface HarnessWorkspaceLayout {
  isolation: "git-worktree";
  repoRoot: string;
  runRoot: string;
  workspaceRoot: string;
  logsDir: string;
  artifactsDir: string;
  metadataDir: string;
  baseRef: string;
  created: boolean;
}

const MAX_RUN_ID_SEGMENT_LENGTH = 64;

function runGit(args: string[], cwd: string): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export function resolveGitRepoRoot(startDir: string): string {
  try {
    return runGit(["rev-parse", "--show-toplevel"], startDir);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[Harness Workspace] Kan git-root niet bepalen vanaf ${startDir}: ${message}`);
  }
}

export function sanitizeHarnessRunIdSegment(runId: string): string {
  const sanitized = runId
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[.-]+/, "")
    .replace(/[.-]+$/, "")
    .slice(0, MAX_RUN_ID_SEGMENT_LENGTH)
    .replace(/[.-]+$/, "");

  return sanitized.length > 0 ? sanitized : "run";
}

export function prepareHarnessWorkspace(
  options: PrepareHarnessWorkspaceOptions,
): HarnessWorkspaceLayout {
  const runPathSegment = sanitizeHarnessRunIdSegment(options.runId);
  const repoRoot = resolve(options.repoRoot);
  const runRoot = resolve(options.runRoot ?? join(repoRoot, ".harness", "runs", runPathSegment));
  const workspaceRoot = resolve(
    options.workspaceRoot ?? join(tmpdir(), "motian-harness", runPathSegment, "workspace"),
  );
  const baseRef = options.baseRef ?? "HEAD";
  const logsDir = join(runRoot, "logs");
  const artifactsDir = join(runRoot, "artifacts");
  const metadataDir = join(runRoot, "metadata");

  mkdirSync(logsDir, { recursive: true });
  mkdirSync(artifactsDir, { recursive: true });
  mkdirSync(metadataDir, { recursive: true });

  const gitPointerPath = join(workspaceRoot, ".git");
  if (existsSync(workspaceRoot)) {
    if (!existsSync(gitPointerPath)) {
      throw new Error(
        `[Harness Workspace] Werkruimtemap bestaat al zonder gekoppelde git-worktree: ${workspaceRoot}`,
      );
    }

    return {
      isolation: "git-worktree",
      repoRoot,
      runRoot,
      workspaceRoot,
      logsDir,
      artifactsDir,
      metadataDir,
      baseRef,
      created: false,
    };
  }

  mkdirSync(dirname(workspaceRoot), { recursive: true });
  runGit(["worktree", "add", "--detach", workspaceRoot, baseRef], repoRoot);

  return {
    isolation: "git-worktree",
    repoRoot,
    runRoot,
    workspaceRoot,
    logsDir,
    artifactsDir,
    metadataDir,
    baseRef,
    created: true,
  };
}

export function teardownHarnessWorkspace(workspace: HarnessWorkspaceLayout): void {
  if (!existsSync(workspace.workspaceRoot)) {
    return;
  }

  runGit(["worktree", "remove", "--force", workspace.workspaceRoot], workspace.repoRoot);
}
