import { db } from "../src/db";
import { scraperConfigs } from "../src/db/schema";

const platforms = [
  {
    platform: "opdrachtoverheid",
    baseUrl: "https://www.opdrachtoverheid.nl/",
    isActive: true,
    parameters: { maxPages: 10 },
    cronExpression: "0 0 */4 * * *",
  },
  {
    platform: "flextender",
    baseUrl: "https://www.flextender.nl/opdrachten/",
    isActive: true,
    parameters: { maxPages: 5 },
    cronExpression: "0 0 */4 * * *",
  },
];

async function seed() {
  console.log("Seeding new platform configs...");
  for (const p of platforms) {
    // Use upsert to be idempotent
    await db.insert(scraperConfigs).values(p).onConflictDoNothing({ target: scraperConfigs.platform });
    console.log(`  ✓ ${p.platform}: ${p.baseUrl}`);
  }
  console.log("Done!");
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
