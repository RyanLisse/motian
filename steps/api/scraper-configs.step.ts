import { StepConfig, Handlers } from "motia";
import { getAllConfigs } from "../../src/services/scrapers";

export const config = {
  name: "GetScraperConfigs",
  description: "Alle scraper configuraties ophalen",
  triggers: [{ type: "http", method: "GET", path: "/api/scraper-configuraties" }],
  flows: ["recruitment-scraper"],
} as const satisfies StepConfig;

export const handler: Handlers<typeof config> = async (_req, { logger }) => {
  try {
    const configs = await getAllConfigs();

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
