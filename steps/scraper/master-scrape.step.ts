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

const CIRCUIT_BREAKER_THRESHOLD = 5;

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

  let dispatched = 0;
  let tripped = 0;

  for (const cfg of activeConfigs) {
    // Circuit breaker: skip platforms with too many consecutive failures
    if ((cfg.consecutiveFailures ?? 0) >= CIRCUIT_BREAKER_THRESHOLD) {
      logger.warn(
        `Circuit breaker open: ${cfg.platform} (${cfg.consecutiveFailures} opeenvolgende fouten) — overgeslagen`,
      );
      tripped++;
      continue;
    }

    await enqueue({
      topic: "platform.scrape",
      data: {
        platform: cfg.platform,
        url: cfg.baseUrl,
      },
    });
    dispatched++;
    logger.info(`Scrape opdracht verstuurd: ${cfg.platform} → ${cfg.baseUrl}`);
  }

  logger.info(
    `${dispatched} platform(en) gestart, ${tripped} overgeslagen (circuit breaker)`,
  );
};
