import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type HarnessProcessOutcome = "succeeded" | "failed" | "timed_out";

export interface HarnessExecutionRequest {
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
  stdoutPath: string;
  stderrPath: string;
}

export interface HarnessProcessResult {
  outcome: HarnessProcessOutcome;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  pid: number | undefined;
  timedOut: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  stdoutPath: string;
  stderrPath: string;
  stdoutTail: string;
  stderrTail: string;
  commandLine: string;
}

const DEFAULT_TIMEOUT_MS = 15 * 60_000;
const MAX_TAIL_LENGTH = 4_000;
const KILL_GRACE_PERIOD_MS = 1_000;

function appendTail(current: string, chunk: string): string {
  const combined = `${current}${chunk}`;
  return combined.length > MAX_TAIL_LENGTH
    ? combined.slice(combined.length - MAX_TAIL_LENGTH)
    : combined;
}

function quoteArgument(arg: string): string {
  return /\s/.test(arg) ? JSON.stringify(arg) : arg;
}

export async function executeHarnessCommand(
  request: HarnessExecutionRequest,
): Promise<HarnessProcessResult> {
  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startedAtDate = new Date();
  const startedAt = startedAtDate.toISOString();

  mkdirSync(dirname(request.stdoutPath), { recursive: true });
  mkdirSync(dirname(request.stderrPath), { recursive: true });

  const stdoutStream = createWriteStream(request.stdoutPath, { flags: "w" });
  const stderrStream = createWriteStream(request.stderrPath, { flags: "w" });

  let stdoutTail = "";
  let stderrTail = "";
  let timedOut = false;
  let spawnError: Error | null = null;

  const child = spawn(request.command, request.args, {
    cwd: request.cwd,
    env: {
      ...process.env,
      ...request.env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.on("data", (chunk) => {
    const text = chunk.toString();
    stdoutTail = appendTail(stdoutTail, text);
    stdoutStream.write(text);
  });

  child.stderr?.on("data", (chunk) => {
    const text = chunk.toString();
    stderrTail = appendTail(stderrTail, text);
    stderrStream.write(text);
  });

  child.on("error", (error) => {
    spawnError = error;
    const message = `[Harness Runtime] Proces kon niet worden gestart: ${error.message}\n`;
    stderrTail = appendTail(stderrTail, message);
    stderrStream.write(message);
  });

  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    const message = `[Harness Runtime] Proces heeft time-out bereikt na ${timeoutMs}ms\n`;
    stderrTail = appendTail(stderrTail, message);
    stderrStream.write(message);
    child.kill("SIGTERM");
    setTimeout(() => {
      child.kill("SIGKILL");
    }, KILL_GRACE_PERIOD_MS).unref();
  }, timeoutMs);

  const closeResult = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve) => {
      child.on("close", (code, signal) => {
        resolve({ code, signal });
      });
    },
  );

  clearTimeout(timeoutHandle);

  await Promise.all([
    new Promise<void>((resolve) => stdoutStream.end(resolve)),
    new Promise<void>((resolve) => stderrStream.end(resolve)),
  ]);

  const finishedAtDate = new Date();
  const finishedAt = finishedAtDate.toISOString();
  const durationMs = finishedAtDate.getTime() - startedAtDate.getTime();
  const outcome: HarnessProcessOutcome = timedOut
    ? "timed_out"
    : spawnError || closeResult.code !== 0
      ? "failed"
      : "succeeded";

  return {
    outcome,
    exitCode: closeResult.code,
    signal: closeResult.signal,
    pid: child.pid,
    timedOut,
    startedAt,
    finishedAt,
    durationMs,
    stdoutPath: request.stdoutPath,
    stderrPath: request.stderrPath,
    stdoutTail,
    stderrTail,
    commandLine: [request.command, ...request.args].map(quoteArgument).join(" "),
  };
}
