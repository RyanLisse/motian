import { pathToFileURL } from "node:url";
import { config } from "dotenv";
import { validateRuntimeEnv } from "../src/lib/runtime-config";

config({ path: ".env.local" });

import { db } from "../src/db";
import { scraperConfigs } from "../src/db/schema";

function reportValidationResult() {
  const result = validateRuntimeEnv();

  for (const warning of result.warnings) {
    console.warn(`[WARN] ${warning}`);
  }

  for (const error of result.errors) {
    console.error(`[FAIL] ${error}`);
  }

  if (result.errors.length === 0) {
    console.log("[PASS] Baseline runtime env validatie geslaagd.");
  }

  return result;
}

export async function main() {
  const result = reportValidationResult();
  if (result.errors.length > 0) {
    process.exit(1);
  }

  const configs = await db.select().from(scraperConfigs);
  console.log(`[PASS] scraperConfigs query returned ${configs.length} rows.`);
  console.log(JSON.stringify(configs, null, 2));
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
