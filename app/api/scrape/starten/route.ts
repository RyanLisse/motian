import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/src/db";
import { scraperConfigs } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { runScrapePipeline } from "@/src/services/scrape-pipeline";

export const dynamic = "force-dynamic";

const triggerSchema = z.object({
  platform: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = triggerSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Ongeldige invoer" }, { status: 400 });
    }

    // Load configs from DB
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
      return Response.json(
        { error: "Geen actieve scraper configuratie gevonden" },
        { status: 404 }
      );
    }

    // Run pipelines via Promise.allSettled (non-blocking)
    const results = await Promise.allSettled(
      configs.map((cfg) => runScrapePipeline(cfg.platform, cfg.baseUrl))
    );

    const summary = configs.map((cfg, i) => {
      const r = results[i];
      return {
        platform: cfg.platform,
        status: r.status === "fulfilled" ? "success" : "failed",
        ...(r.status === "fulfilled" ? r.value : { error: String(r.reason) }),
      };
    });

    return Response.json({
      message: `Scrape gestart voor ${configs.length} platform(en)`,
      platforms: summary,
    });
  } catch (err) {
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}
