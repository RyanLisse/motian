import { StepConfig, Handlers } from "motia";
import { db } from "../../src/db";
import { scrapeResults } from "../../src/db/schema";
import { desc, eq } from "drizzle-orm";

export const config = {
  name: "GetScrapeHistory",
  description: "Laatste 50 scrape resultaten ophalen",
  triggers: [
    {
      type: "http",
      method: "GET",
      path: "/api/scrape-resultaten",
      queryParams: [
        { name: "platform", description: "Filter op platform" },
        { name: "limit", description: "Aantal resultaten (default: 50)" },
      ],
    },
  ],
  flows: ["recruitment-scraper"],
} as const satisfies StepConfig;

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  try {
    const rawLimit = req.queryParams?.limit;
    const limit = Math.min(
      Number(Array.isArray(rawLimit) ? rawLimit[0] : rawLimit) || 50,
      100,
    );
    const rawPlatform = req.queryParams?.platform;
    const platform = Array.isArray(rawPlatform)
      ? rawPlatform[0]
      : rawPlatform;

    const baseQuery = db.select().from(scrapeResults);
    const filtered = platform
      ? baseQuery.where(eq(scrapeResults.platform, platform))
      : baseQuery;
    const results = await filtered
      .orderBy(desc(scrapeResults.runAt))
      .limit(limit);

    return {
      status: 200,
      body: { data: results, total: results.length },
    };
  } catch (err) {
    logger.error(`Fout bij ophalen scrape history: ${String(err)}`);
    return {
      status: 500,
      body: { error: "Interne serverfout" },
    };
  }
};
