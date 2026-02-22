import { NextRequest } from "next/server";
import { db } from "@/src/db";
import { scraperConfigs } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { runScrapePipeline } from "@/src/services/scrape-pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min max for Vercel Pro

const CIRCUIT_BREAKER_THRESHOLD = 5;

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const activeConfigs = await db
      .select()
      .from(scraperConfigs)
      .where(eq(scraperConfigs.isActive, true));

    if (activeConfigs.length === 0) {
      return Response.json({ message: "Geen actieve scraper configs" });
    }

    const results: any[] = [];
    let dispatched = 0;
    let tripped = 0;

    // Filter circuit breaker
    const eligible = activeConfigs.filter((cfg) => {
      if ((cfg.consecutiveFailures ?? 0) >= CIRCUIT_BREAKER_THRESHOLD) {
        tripped++;
        results.push({
          platform: cfg.platform,
          status: "circuit_breaker_open",
          consecutiveFailures: cfg.consecutiveFailures,
        });
        return false;
      }
      return true;
    });

    // Run all eligible scrapers in parallel
    const settled = await Promise.allSettled(
      eligible.map((cfg) => runScrapePipeline(cfg.platform, cfg.baseUrl))
    );

    for (let i = 0; i < eligible.length; i++) {
      const r = settled[i];
      dispatched++;
      results.push({
        platform: eligible[i].platform,
        ...(r.status === "fulfilled"
          ? { status: "success", ...r.value }
          : { status: "failed", error: String(r.reason) }),
      });
    }

    return Response.json({
      message: `${dispatched} platform(en) verwerkt, ${tripped} overgeslagen (circuit breaker)`,
      results,
    });
  } catch (err) {
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}
