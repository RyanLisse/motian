import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { argv } from "node:process";
import { parseArgs } from "node:util";

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

const requiredSections = [
  "# ", // Main Title
  "## Proposed Changes",
  "## Verification Plan",
];

let hasErrors = false;

for (const section of requiredSections) {
  if (!planContent.includes(section)) {
    console.error(`[FAIL] Plan is missing required section: "${section}"`);
    hasErrors = true;
  } else {
    console.log(`[PASS] Found section: "${section}"`);
  }
}

if (hasErrors) {
  console.error(
    "\nPlan validation failed. Please adhere to the Harness Engineering standards for planning documents.",
  );
  process.exit(1);
}

console.log("\n✅ Plan successfully validated. Proceed with execution.");
process.exit(0);
