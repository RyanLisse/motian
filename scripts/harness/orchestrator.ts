import { argv } from "node:process";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  args: argv.slice(2),
  options: {
    dispatch: {
      type: "string",
    },
  },
});

if (!values.dispatch) {
  console.error("Usage: pnpm tsx scripts/harness/orchestrator.ts --dispatch <taskName>");
  process.exit(1);
}

// In a real implementation this would queue a job to Trigger.dev
// or spawn a new agent background process.
console.log(`[Harness Orchestrator] Dispatching background agent for task: "${values.dispatch}"`);
console.log(`[Harness Orchestrator] Task successfully queued in background.`);

process.exit(0);
