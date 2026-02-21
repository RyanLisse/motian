import { StepConfig, Handlers } from "motia";
import { z } from "zod";
import { db } from "../../src/db";
import { scraperConfigs } from "../../src/db/schema";
import { eq } from "drizzle-orm";

const updateSchema = z.object({
  isActive: z.boolean().optional(),
  cronExpression: z.string().optional(),
  parameters: z.record(z.unknown()).optional(),
});

export const config = {
  name: "UpdateScraperConfig",
  description: "Scraper configuratie bijwerken (toggle, cron, parameters)",
  triggers: [
    {
      type: "http",
      method: "PATCH",
      path: "/api/scraper-configuraties/:id",
      input: updateSchema,
    },
  ],
  flows: ["recruitment-scraper"],
} as const satisfies StepConfig;

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { id } = req.pathParams;

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return {
      status: 400,
      body: { error: "Ongeldige invoer", details: parsed.error.flatten() },
    };
  }

  try {
    const result = await db
      .update(scraperConfigs)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
      })
      .where(eq(scraperConfigs.id, id))
      .returning();

    if (result.length === 0) {
      return {
        status: 404,
        body: { error: "Scraper configuratie niet gevonden" },
      };
    }

    logger.info(`Scraper config ${id} bijgewerkt: ${JSON.stringify(parsed.data)}`);

    return {
      status: 200,
      body: { data: result[0] },
    };
  } catch (err) {
    logger.error(`Fout bij bijwerken config ${id}: ${String(err)}`);
    return {
      status: 500,
      body: { error: "Interne serverfout" },
    };
  }
};
