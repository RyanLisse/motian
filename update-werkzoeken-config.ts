import { db } from "./src/db";
import { scraperConfigs } from "./src/db/schema";
import { eq } from "drizzle-orm";

async function run() {
  const platform = "werkzoeken";
  const [current] = await db.select().from(scraperConfigs).where(eq(scraperConfigs.platform, platform)).limit(1);
  console.log("Current Config:", JSON.stringify(current, null, 2));

  if (current) {
    const currentParameters =
      (current.parameters && typeof current.parameters === "object"
        ? current.parameters
        : {}) as Record<string, unknown>;

    await db.update(scraperConfigs)
      .set({
        parameters: {
          ...currentParameters,
          maxPages: 1300,
          pnrStep: 10,
          skipDetailEnrichment: true,
        },
        isActive: true,
      })
      .where(eq(scraperConfigs.platform, platform));
    console.log("\n✅ Updated config to optimized values.");
  } else {
    await db.insert(scraperConfigs).values({
      platform: "werkzoeken",
      baseUrl: "https://www.werkzoeken.nl",
      isActive: true,
      parameters: {
        sourcePath: "/vacatures-voor/techniek/",
        maxPages: 1300,
        pnrStep: 10,
        skipDetailEnrichment: true,
        detailConcurrency: 4
      }
    });
    console.log("\n✅ Created new optimized config for werkzoeken.");
  }
}

run().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
