import { argv } from "node:process";
import { parseArgs } from "node:util";
import { formatHarnessRunSummary, orchestrateHarnessRun } from "@/src/harness/orchestrator";

const { values } = parseArgs({
  args: argv.slice(2),
  options: {
    dispatch: {
      type: "string",
    },
    command: {
      type: "string",
    },
    arg: {
      type: "string",
      multiple: true,
    },
    "timeout-ms": {
      type: "string",
    },
    "base-ref": {
      type: "string",
    },
    "repo-root": {
      type: "string",
    },
    "workspace-root": {
      type: "string",
    },
    "run-root": {
      type: "string",
    },
  },
});

if (!values.dispatch) {
  console.error(
    "Gebruik: pnpm tsx scripts/harness/orchestrator.ts --dispatch <taaknaam> [--command <bin>] [--arg <waarde>]",
  );
  process.exit(1);
}

const timeoutMs = values["timeout-ms"] ? Number(values["timeout-ms"]) : undefined;

if (values["timeout-ms"] && Number.isNaN(timeoutMs)) {
  console.error(`[Harness Orchestrator] Ongeldige --timeout-ms-waarde: ${values["timeout-ms"]}`);
  process.exit(1);
}

const manifest = await orchestrateHarnessRun({
  dispatch: values.dispatch,
  command: values.command,
  args: values.arg ?? [],
  timeoutMs,
  baseRef: values["base-ref"],
  repoRoot: values["repo-root"],
  workspaceRoot: values["workspace-root"],
  runRoot: values["run-root"],
});

console.log(formatHarnessRunSummary(manifest));

process.exit(manifest.status === "succeeded" ? 0 : 1);
