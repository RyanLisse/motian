import { ApiRouteConfig, Handlers } from "motia";
import { z } from "zod";
import { db } from "../../src/db";
import { scraperConfigs } from "../../src/db/schema";
import { eq } from "drizzle-orm";

const triggerSchema = z.object({
  platform: z.string().optional(),
});

export const config: ApiRouteConfig = {
  type: "api",
  name: "TriggerScrape",
  description: "Handmatig een scrape starten voor één of alle platformen",
  path: "/api/scrape/starten",
  method: "POST",
  bodySchema: triggerSchema,
  emits: ["platform.scrape"],
  flows: ["recruitment-scraper"],
};

export const handler: Handlers["TriggerScrape"] = async (
  req,
  { emit, logger },
) => {
  const parsed = triggerSchema.safeParse(req.body);
  if (!parsed.success) {
    return {
      status: 400,
      body: { error: "Ongeldige invoer" },
    };
  }

  try {
    // Bepaal welke platformen te scrapen
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

    // Emit scrape events voor elk platform
    for (const cfg of configs) {
      await emit({
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
