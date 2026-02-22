/**
 * Backfill AI enrichment for existing jobs.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/backfill-enrichment.ts --platform opdrachtoverheid --limit 100
 *   npx tsx --env-file=.env.local scripts/backfill-enrichment.ts --limit 50
 */
import { enrichJobsBatch } from "../src/services/ai-enrichment";

async function main() {
  const args = process.argv.slice(2);
  let platform: string | undefined;
  let limit = 50;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--platform" && args[i + 1]) {
      platform = args[i + 1];
      i++;
    }
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    }
  }

  console.log(`Backfill enrichment: platform=${platform ?? "all"}, limit=${limit}`);
  const result = await enrichJobsBatch({ platform, limit });

  console.log("\nResults:");
  console.log(`  Enriched: ${result.enriched}`);
  console.log(`  Skipped:  ${result.skipped}`);
  console.log(`  Errors:   ${result.errors.length}`);

  if (result.errors.length > 0) {
    console.log("\nErrors:");
    for (const err of result.errors) {
      console.log(`  - ${err}`);
    }
  }

  process.exit(result.errors.length > 0 ? 1 : 0);
}

main();
