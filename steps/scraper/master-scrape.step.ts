import { StepConfig, Handlers } from "motia";
import { db } from "../../src/db";
import { scraperConfigs } from "../../src/db/schema";
import { eq } from "drizzle-orm";

export const config = {
  name: "MasterScrape",
  description: "Elke 4 uur alle actieve platformen scrapen (configs uit DB)",
  triggers: [{ type: "cron", expression: "0 0 */4 * * *" }],
  enqueues: [{ topic: "platform.scrape" }],
  flows: ["recruitment-scraper"],
} as const satisfies StepConfig;

export const handler: Handlers<typeof config> = async (_input, { enqueue, logger }) => {
  logger.info("Master scrape gestart — configs laden uit database");

  const activeConfigs = await db
    .select()
    .from(scraperConfigs)
    .where(eq(scraperConfigs.isActive, true));

  if (activeConfigs.length === 0) {
    logger.warn("Geen actieve scraper configs gevonden");
    return;
  }

  for (const cfg of activeConfigs) {
    await enqueue({
      topic: "platform.scrape",
      data: {
        platform: cfg.platform,
        url: cfg.baseUrl,
        parameters: cfg.parameters,
      },
    });
    logger.info(`Scrape opdracht verstuurd: ${cfg.platform} → ${cfg.baseUrl}`);
  }

  logger.info(`${activeConfigs.length} platform(en) gestart`);
};
