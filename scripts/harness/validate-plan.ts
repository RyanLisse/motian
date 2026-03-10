import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { argv } from "node:process";
import { parseArgs } from "node:util";
import { validateHarnessPlanDocument } from "@/src/harness/workflow/validation";

const { values } = parseArgs({
  args: argv.slice(2),
  options: {
    file: {
      type: "string",
    },
  },
});

if (!values.file) {
  console.error("Usage: pnpm tsx scripts/harness/validate-plan.ts --file <path-to-plan.md>");
  process.exit(1);
}

const targetFile = path.resolve(process.cwd(), values.file);

if (!existsSync(targetFile)) {
  console.error(`Error: File not found exactly at ${targetFile}`);
  process.exit(1);
}

const planContent = readFileSync(targetFile, "utf-8");

const result = validateHarnessPlanDocument(planContent);

if (!result.ok) {
  console.error("Plan validation failed:\n");
  for (const issue of result.issues) {
    const severity = issue.severity === "error" ? "ERROR" : "WARN";
    console.error(`[${severity}] ${issue.path}: ${issue.message}`);
  }
  console.error("\nPlease adhere to the Harness Engineering standards for planning documents.");
  process.exit(1);
}

console.log("✅ Plan successfully validated. Proceed with execution.");
process.exit(0);
