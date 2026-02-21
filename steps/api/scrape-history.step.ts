import { ApiRouteConfig, Handlers } from "motia";
import { db } from "../../src/db";
import { scrapeResults } from "../../src/db/schema";
import { desc, eq } from "drizzle-orm";

export const config: ApiRouteConfig = {
  type: "api",
  name: "GetScrapeHistory",
  description: "Laatste 50 scrape resultaten ophalen",
  path: "/api/scrape-resultaten",
  method: "GET",
  flows: ["recruitment-scraper"],
  emits: [],
  queryParams: [
    { name: "platform", description: "Filter op platform" },
    { name: "limit", description: "Aantal resultaten (default: 50)" },
  ],
};

export const handler: Handlers["GetScrapeHistory"] = async (
  req,
  { logger },
) => {
  try {
    const limit = Math.min(Number(req.query?.limit) || 50, 100);
    const platform = req.query?.platform;

    let query = db
      .select()
      .from(scrapeResults)
      .orderBy(desc(scrapeResults.runAt))
      .limit(limit);

    if (platform) {
      query = query.where(eq(scrapeResults.platform, platform)) as typeof query;
    }

    const results = await query;

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
