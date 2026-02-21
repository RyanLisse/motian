import { ApiRouteConfig, Handlers } from "motia";
import { db } from "../../src/db";
import { scraperConfigs } from "../../src/db/schema";
import { asc } from "drizzle-orm";

export const config: ApiRouteConfig = {
  type: "api",
  name: "GetScraperConfigs",
  description: "Alle scraper configuraties ophalen",
  path: "/api/scraper-configuraties",
  method: "GET",
  flows: ["recruitment-scraper"],
  emits: [],
};

export const handler: Handlers["GetScraperConfigs"] = async (
  _req,
  { logger },
) => {
  try {
    const configs = await db
      .select()
      .from(scraperConfigs)
      .orderBy(asc(scraperConfigs.platform));

    return {
      status: 200,
      body: { data: configs, total: configs.length },
    };
  } catch (err) {
    logger.error(`Fout bij ophalen scraper configs: ${String(err)}`);
    return {
      status: 500,
      body: { error: "Interne serverfout" },
    };
  }
};
