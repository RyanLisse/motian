/**
 * Run Flextender scrape in-process so debug ingest (127.0.0.1:7696) receives logs.
 * Usage: pnpm exec tsx scripts/run-flextender-scrape.ts
 * Ensure debug ingest server is running and writing to .cursor/debug-df9709.log
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { runScrapePipeline } from "../src/services/scrape-pipeline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", ".env.local") });

async function main() {
  console.log("Starting Flextender scrape (logs → 127.0.0.1:7696 if ingest running)...");
  const result = await runScrapePipeline("flextender", "");
  console.log("Flextender scrape finished:", result);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
