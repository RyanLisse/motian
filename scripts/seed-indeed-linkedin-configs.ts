/**
 * Seed script: Indeed + LinkedIn scraper configuraties invoegen
 * Gebruik: pnpm tsx scripts/seed-indeed-linkedin-configs.ts
 */
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: ".env.local" });

import { db } from "../src/db";
import { scraperConfigs } from "../src/db/schema";

async function seed() {
  console.log("Seeding Indeed scraper config...");

  await db
    .insert(scraperConfigs)
    .values({
      platform: "indeed",
      baseUrl: "https://nl.indeed.com/jobs?q=ICT+freelance&l=Nederland",
      isActive: true,
      parameters: {
        maxPages: 5,
        maxRetries: 2,
      },
      cronExpression: "0 0 */6 * * *",
    })
    .onConflictDoUpdate({
      target: [scraperConfigs.platform],
      set: {
        baseUrl: "https://nl.indeed.com/jobs?q=ICT+freelance&l=Nederland",
        isActive: true,
        parameters: {
          maxPages: 5,
          maxRetries: 2,
        },
        cronExpression: "0 0 */6 * * *",
        updatedAt: new Date(),
      },
    });

  console.log("Indeed scraper config geseeded!");

  console.log("Seeding LinkedIn scraper config...");

  await db
    .insert(scraperConfigs)
    .values({
      platform: "linkedin",
      baseUrl:
        "https://www.linkedin.com/jobs/search/?keywords=ICT%20freelance&location=Netherlands",
      isActive: false,
      parameters: {
        maxPages: 3,
        maxRetries: 2,
      },
      cronExpression: "0 0 */8 * * *",
    })
    .onConflictDoUpdate({
      target: [scraperConfigs.platform],
      set: {
        baseUrl:
          "https://www.linkedin.com/jobs/search/?keywords=ICT%20freelance&location=Netherlands",
        isActive: false,
        parameters: {
          maxPages: 3,
          maxRetries: 2,
        },
        cronExpression: "0 0 */8 * * *",
        updatedAt: new Date(),
      },
    });

  console.log("LinkedIn scraper config geseeded!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed gefaald:", err);
  process.exit(1);
});
