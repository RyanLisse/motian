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
    throw new Error(
      `[Harness Workspace] Unable to resolve git repository root from ${startDir}: ${message}`,
    );
  }
}

export function prepareHarnessWorkspace(
  options: PrepareHarnessWorkspaceOptions,
): HarnessWorkspaceLayout {
  const repoRoot = resolve(options.repoRoot);
  const runRoot = resolve(options.runRoot ?? join(repoRoot, ".harness", "runs", options.runId));
  const workspaceRoot = resolve(
    options.workspaceRoot ?? join(tmpdir(), "motian-harness", options.runId, "workspace"),
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
        `[Harness Workspace] Workspace root already exists without a git worktree: ${workspaceRoot}`,
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
