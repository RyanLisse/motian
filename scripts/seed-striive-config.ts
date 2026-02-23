/**
 * Seed script: Striive scraper configuratie invoegen
 * Gebruik: pnpm tsx scripts/seed-striive-config.ts
 */
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: ".env.local" });

import { db } from "../src/db";
import { scraperConfigs } from "../src/db/schema";

async function seed() {
  console.log("Seeding Striive scraper config...");

  await db
    .insert(scraperConfigs)
    .values({
      platform: "striive",
      baseUrl: "https://striive.com/nl/opdrachten",
      isActive: true,
      parameters: {
        maxPages: 5,
        maxRetries: 2,
      },
      cronExpression: "0 0 */4 * * *",
    })
    .onConflictDoUpdate({
      target: [scraperConfigs.platform],
      set: {
        baseUrl: "https://striive.com/nl/opdrachten",
        isActive: true,
        parameters: {
          maxPages: 5,
          maxRetries: 2,
        },
        cronExpression: "0 0 */4 * * *",
        updatedAt: new Date(),
      },
    });

  console.log("Striive scraper config geseeded!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed gefaald:", err);
  process.exit(1);
});
