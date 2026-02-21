import { StepConfig, Handlers } from "motia";
import { getHistory } from "../../src/services/scrape-results";

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
    const limit = Number(Array.isArray(rawLimit) ? rawLimit[0] : rawLimit) || 50;
    const rawPlatform = req.queryParams?.platform;
    const platform = Array.isArray(rawPlatform)
      ? rawPlatform[0]
      : rawPlatform;

    const results = await getHistory({ platform, limit });

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
