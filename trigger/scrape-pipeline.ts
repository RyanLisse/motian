import { logger, schedules } from "@trigger.dev/sdk";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scraperConfigs } from "@/src/db/schema";
import { publish } from "@/src/lib/event-bus";
import { CIRCUIT_BREAKER_THRESHOLD } from "@/src/lib/helpers";
import { notifySlack } from "@/src/lib/notify-slack";
import { trackServerEvent } from "@/src/lib/posthog";
import { runScrapePipelinesWithConcurrency } from "@/src/services/scrape-pipeline";

// ========== Helpers ==========

function cronIntervalMs(expr: string | null | undefined): number {
  const HOUR = 3_600_000;
  if (!expr) return 24 * HOUR;

  const parts = expr.trim().split(/\s+/);
  const fields = parts.length === 6 ? parts.slice(1) : parts;
  if (fields.length < 5) return 24 * HOUR;

  const [minute, hour] = fields;

  const hourStep = hour.match(/^\*\/(\d+)$/);
  if (hourStep) return Number(hourStep[1]) * HOUR;

  const minStep = minute.match(/^\*\/(\d+)$/);
  if (minStep) return Number(minStep[1]) * 60_000;

  if (/^\d+$/.test(hour) && /^\d+$/.test(minute)) return 24 * HOUR;

  return 24 * HOUR;
}

function isDue(
  cronExpression: string | null | undefined,
  lastRunAt: Date | null | undefined,
): boolean {
  if (!lastRunAt) return true;
  const interval = cronIntervalMs(cronExpression);
  const grace = 5 * 60_000;
  return Date.now() - lastRunAt.getTime() >= interval - grace;
}

// ========== Scheduled Task ==========

export const scrapePipelineTask = schedules.task({
  id: "scrape-pipeline",
  cron: {
    pattern: "0 6,10,14,18 * * *", // Alleen tussen 06:00 en 18:00, elke 4 uur
    timezone: "Europe/Amsterdam",
  },
  maxDuration: 600, // 10 minutes max
  run: async () => {
    const activeConfigs = await db
      .select()
      .from(scraperConfigs)
      .where(eq(scraperConfigs.isActive, true));

    if (activeConfigs.length === 0) {
      logger.info("Geen actieve scraper configs");
      return { dispatched: 0, results: [] };
    }

    let dispatched = 0;
    let tripped = 0;
    let skippedSchedule = 0;
    const results: Record<string, unknown>[] = [];

    // Filter: circuit breaker + schedule check
    const eligible = activeConfigs.filter((cfg) => {
      if ((cfg.consecutiveFailures ?? 0) >= CIRCUIT_BREAKER_THRESHOLD) {
        tripped++;
        publish("scrape:circuit_breaker_open", {
          platform: cfg.platform,
          consecutiveFailures: cfg.consecutiveFailures ?? 0,
          threshold: CIRCUIT_BREAKER_THRESHOLD,
          source: "trigger.dev",
        });
        logger.warn(`Circuit breaker open for ${cfg.platform}`, {
          consecutiveFailures: cfg.consecutiveFailures,
        });
        trackServerEvent("system", "scrape_circuit_breaker_open", {
          platform: cfg.platform,
          consecutiveFailures: cfg.consecutiveFailures ?? 0,
          threshold: CIRCUIT_BREAKER_THRESHOLD,
        });
        results.push({ platform: cfg.platform, status: "circuit_breaker_open" });
        return false;
      }

      if (!isDue(cfg.cronExpression, cfg.lastRunAt)) {
        skippedSchedule++;
        results.push({ platform: cfg.platform, status: "not_due" });
        return false;
      }

      return true;
    });

    const settled = await runScrapePipelinesWithConcurrency(eligible);

    for (let i = 0; i < eligible.length; i++) {
      const r = settled[i];
      dispatched++;
      const platform = eligible[i].platform;
      if (r.status === "fulfilled") {
        const scrapeData = { platform, status: "success", ...r.value };
        results.push(scrapeData);
        notifySlack("scrape:complete", scrapeData);
        trackServerEvent("system", "scrape_completed", {
          platform,
          ...r.value,
        });
      } else {
        results.push({ platform, status: "failed", error: String(r.reason) });
        notifySlack("scrape:complete", {
          platform,
          status: "failed",
          jobsFound: 0,
          jobsNew: 0,
          duplicates: 0,
          durationMs: 0,
        });
        trackServerEvent("system", "scrape_failed", {
          platform,
          error: String(r.reason),
        });
      }
    }

    if (tripped > 0) {
      publish("scrape:alert", {
        severity: "warning",
        type: "circuit_breaker_open",
        tripped,
      });
      notifySlack("scrape:alert", {
        severity: "warning",
        type: "circuit_breaker_open",
        tripped: activeConfigs
          .filter((cfg) => (cfg.consecutiveFailures ?? 0) >= CIRCUIT_BREAKER_THRESHOLD)
          .map((cfg) => cfg.platform),
      });
      trackServerEvent("system", "scrape_circuit_breaker", { tripped });
    }

    logger.info("Scrape pipeline voltooid", {
      dispatched,
      tripped,
      skippedSchedule,
    });
    trackServerEvent("system", "scrape_pipeline_completed", {
      dispatched,
      tripped,
      skippedSchedule,
    });

    return { dispatched, tripped, skippedSchedule, results };
  },
});
