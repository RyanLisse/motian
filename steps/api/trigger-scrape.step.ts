import { StepConfig, Handlers } from "motia";
import { z } from "zod";
import { db } from "../../src/db";
import { scraperConfigs } from "../../src/db/schema";
import { eq } from "drizzle-orm";

const triggerSchema = z.object({
  platform: z.string().optional(),
});

export const config = {
  name: "TriggerScrape",
  description: "Handmatig een scrape starten voor één of alle platformen",
  triggers: [
    {
      type: "http",
      method: "POST",
      path: "/api/scrape/starten",
      input: triggerSchema,
    },
  ],
  enqueues: [{ topic: "platform.scrape" }],
  flows: ["recruitment-scraper"],
} as const satisfies StepConfig;

export const handler: Handlers<typeof config> = async (req, { enqueue, logger }) => {
  const parsed = triggerSchema.safeParse(req.body);
  if (!parsed.success) {
    return {
      status: 400,
      body: { error: "Ongeldige invoer" },
    };
  }

  try {
    let configs;
    if (parsed.data.platform) {
      configs = await db
        .select()
        .from(scraperConfigs)
        .where(eq(scraperConfigs.platform, parsed.data.platform))
        .limit(1);
    } else {
      configs = await db
        .select()
        .from(scraperConfigs)
        .where(eq(scraperConfigs.isActive, true));
    }

    if (configs.length === 0) {
      return {
        status: 404,
        body: { error: "Geen actieve scraper configuratie gevonden" },
      };
    }

    for (const cfg of configs) {
      await enqueue({
        topic: "platform.scrape",
        data: {
          platform: cfg.platform,
          url: cfg.baseUrl,
        },
      });
      logger.info(`Handmatige scrape gestart: ${cfg.platform}`);
    }

    return {
      status: 200,
      body: {
        message: `Scrape gestart voor ${configs.length} platform(en)`,
        platforms: configs.map((c) => c.platform),
      },
    };
  } catch (err) {
    logger.error(`Fout bij handmatige scrape: ${String(err)}`);
    return {
      status: 500,
      body: { error: "Interne serverfout" },
    };
  }
};
