import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  formatHarnessRunSummary,
  orchestrateHarnessRun,
  readHarnessRunManifest,
} from "../../src/harness/orchestrator";
import { executeHarnessCommand } from "../../src/harness/runtime";
import { prepareHarnessWorkspace } from "../../src/harness/workspace";

function createGitRepo(root: string): string {
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
  writeFileSync(join(root, "README.md"), "seed\n", "utf8");
  execFileSync("git", ["add", "README.md"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "init"], { cwd: root, stdio: "ignore" });
  return root;
}

describe("harness workspace", () => {
  it("creates an isolated git worktree and run directories", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "motian-harness-workspace-"));

    try {
      const repoRoot = createGitRepo(join(tempRoot, "repo"));
      const layout = prepareHarnessWorkspace({
        repoRoot,
        runId: "workspace-test",
        runRoot: join(tempRoot, "run"),
        workspaceRoot: join(tempRoot, "isolated-worktree"),
      });

      expect(layout.created).toBe(true);
      expect(layout.workspaceRoot).not.toBe(repoRoot);
      expect(existsSync(join(layout.workspaceRoot, ".git"))).toBe(true);
      expect(readFileSync(join(layout.workspaceRoot, "README.md"), "utf8")).toContain("seed");
      expect(existsSync(layout.logsDir)).toBe(true);
      expect(existsSync(layout.artifactsDir)).toBe(true);
      expect(existsSync(layout.metadataDir)).toBe(true);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

describe("harness runtime", () => {
  it("captures stdout/stderr and normalizes a successful process result", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "motian-harness-runtime-"));

    try {
      const result = await executeHarnessCommand({
        command: process.execPath,
        args: ["-e", 'console.log("hello"); console.error("warning")'],
        cwd: tempRoot,
        timeoutMs: 2_000,
        stdoutPath: join(tempRoot, "stdout.log"),
        stderrPath: join(tempRoot, "stderr.log"),
      });

      expect(result.outcome).toBe("succeeded");
      expect(result.exitCode).toBe(0);
      expect(readFileSync(result.stdoutPath, "utf8")).toContain("hello");
      expect(readFileSync(result.stderrPath, "utf8")).toContain("warning");
      expect(result.commandLine).toContain(process.execPath);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("marks timed out processes explicitly", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "motian-harness-timeout-"));

    try {
      const result = await executeHarnessCommand({
        command: process.execPath,
        args: ["-e", 'setTimeout(() => console.log("late"), 1_000)'],
        cwd: tempRoot,
        timeoutMs: 50,
        stdoutPath: join(tempRoot, "stdout.log"),
        stderrPath: join(tempRoot, "stderr.log"),
      });

      expect(result.outcome).toBe("timed_out");
      expect(result.timedOut).toBe(true);
      expect(readFileSync(result.stderrPath, "utf8")).toContain("Timed out");
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

describe("harness orchestrator", () => {
  it("persists lifecycle, workspace, and process artifacts for a run", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "motian-harness-orchestrator-"));

    try {
      const repoRoot = createGitRepo(join(tempRoot, "repo"));
      const manifest = await orchestrateHarnessRun({
        dispatch: "unit-test-dispatch",
        command: process.execPath,
        args: ["-e", "console.log(process.env.HARNESS_DISPATCH);"],
        timeoutMs: 2_000,
        repoRoot,
        runId: "run-001",
        runRoot: join(tempRoot, "run-data"),
        workspaceRoot: join(tempRoot, "run-worktree"),
        externalContext: {
          triggerRunId: "trigger_123",
          githubCheckRunId: 42,
        },
      });

      expect(manifest.status).toBe("succeeded");
      expect(manifest.workspace?.created).toBe(true);
      expect(manifest.result?.stdoutTail).toContain("unit-test-dispatch");
      expect(manifest.lifecycle.map((event) => event.status)).toEqual([
        "queued",
        "preparing_workspace",
        "workspace_ready",
        "running",
        "succeeded",
      ]);

      const persistedManifest = readHarnessRunManifest(manifest.integration.manifestPath, repoRoot);
      expect(persistedManifest.status).toBe("succeeded");
      expect(persistedManifest.externalContext?.triggerRunId).toBe("trigger_123");
      expect(persistedManifest.artifacts.map((artifact) => artifact.kind)).toEqual([
        "manifest",
        "stdout",
        "stderr",
        "workspace",
      ]);

      const summary = formatHarnessRunSummary(manifest);
      expect(summary).toContain("unit-test-dispatch");
      expect(summary).toContain("succeeded");
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
