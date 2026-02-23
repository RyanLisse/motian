import { tool } from "ai";
import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/src/db";
import { scraperConfigs } from "@/src/db/schema";
import { runScrapePipeline } from "@/src/services/scrape-pipeline";

export const triggerScraper = tool({
  description:
    "Start een scraper voor een specifiek platform. Beschikbare platforms: flextender, striive, opdrachtoverheid. Dit kan even duren (30s-2min).",
  inputSchema: z.object({
    platform: z
      .enum(["flextender", "striive", "opdrachtoverheid"])
      .describe("Het platform om te scrapen"),
  }),
  execute: async ({ platform }) => {
    // Look up the config to get the base URL
    const [config] = await db
      .select()
      .from(scraperConfigs)
      .where(eq(scraperConfigs.platform, platform))
      .limit(1);

    if (!config) {
      return { error: `Geen scraper configuratie gevonden voor ${platform}` };
    }

    if (!config.isActive) {
      return { error: `Scraper voor ${platform} is niet actief` };
    }

    const result = await runScrapePipeline(platform, config.baseUrl);

    // Revalidate cached pages so UI reflects new data
    revalidateTag("jobs", "default");
    revalidateTag("scrape-results", "default");
    revalidateTag("scrapers", "default");

    return {
      platform,
      jobsNew: result.jobsNew,
      duplicates: result.duplicates,
      errors: result.errors.length > 0 ? result.errors : undefined,
      status: result.errors.length === 0 ? "success" : "partial",
    };
  },
});
