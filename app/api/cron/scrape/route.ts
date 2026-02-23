import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/src/db";
import { scraperConfigs } from "@/src/db/schema";
import { runScrapePipeline } from "@/src/services/scrape-pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min max for Vercel Pro

const CIRCUIT_BREAKER_THRESHOLD = 5;

/**
 * Parse a cron expression to extract the interval in milliseconds.
 *
 * Supports standard 5-field (min hour day month weekday) and 6-field
 * (sec min hour day month weekday) cron expressions. Handles common
 * step patterns like {@code *}{@code /N} for hours and minutes.
 *
 * Returns the minimum interval between runs. For expressions that
 * cannot be parsed, falls back to 24 hours.
 */
function cronIntervalMs(expr: string | null | undefined): number {
  const HOUR = 3_600_000;
  if (!expr) return 24 * HOUR;

  const parts = expr.trim().split(/\s+/);
  // Normalise 6-field (with seconds) to 5-field
  const fields = parts.length === 6 ? parts.slice(1) : parts;

  if (fields.length < 5) return 24 * HOUR;

  const [minute, hour] = fields;

  // */N in the hour field → every N hours
  const hourStep = hour.match(/^\*\/(\d+)$/);
  if (hourStep) return Number(hourStep[1]) * HOUR;

  // */N in the minute field → every N minutes
  const minStep = minute.match(/^\*\/(\d+)$/);
  if (minStep) return Number(minStep[1]) * 60_000;

  // Specific hour (e.g. "0 6 * * *") → once per day
  if (/^\d+$/.test(hour) && /^\d+$/.test(minute)) return 24 * HOUR;

  // Default: once per day
  return 24 * HOUR;
}

/**
 * Determine whether a scraper should run now based on its cron
 * expression and when it last ran. Adds a 5-minute grace window
 * to avoid drift issues with Vercel cron triggers.
 */
function isDue(
  cronExpression: string | null | undefined,
  lastRunAt: Date | null | undefined,
): boolean {
  if (!lastRunAt) return true; // never run before → always due

  const interval = cronIntervalMs(cronExpression);
  const grace = 5 * 60_000; // 5 min grace to avoid edge-of-window misses
  return Date.now() - lastRunAt.getTime() >= interval - grace;
}

interface ScrapeResult {
  platform: string;
  status: string;
  [key: string]: unknown;
}

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

    const results: ScrapeResult[] = [];
    let dispatched = 0;
    let tripped = 0;
    let skippedSchedule = 0;

    // Filter: circuit breaker + schedule check
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

      if (!isDue(cfg.cronExpression, cfg.lastRunAt)) {
        skippedSchedule++;
        results.push({
          platform: cfg.platform,
          status: "not_due",
          cronExpression: cfg.cronExpression,
          lastRunAt: cfg.lastRunAt?.toISOString() ?? null,
        });
        return false;
      }

      return true;
    });

    // Run all eligible scrapers in parallel
    const settled = await Promise.allSettled(
      eligible.map((cfg) => runScrapePipeline(cfg.platform, cfg.baseUrl)),
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
      message: `${dispatched} verwerkt, ${tripped} circuit breaker, ${skippedSchedule} niet gepland`,
      results,
    });
  } catch (_err) {
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}
