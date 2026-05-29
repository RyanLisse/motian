import { logger, schedules } from "@trigger.dev/sdk";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scraperConfigs } from "@/src/db/schema";
import { publish } from "@/src/lib/event-bus";
import { CIRCUIT_BREAKER_THRESHOLD } from "@/src/lib/helpers";
import { notifySlack } from "@/src/lib/notify-slack";
import { trackServerEvent } from "@/src/lib/posthog";
import { getScrapeScheduleDecision } from "@/src/lib/scrape-schedule";
import { runScrapePipelinesWithConcurrency } from "@/src/services/scrape-pipeline";

// ========== Scheduled Task ==========

export const scrapePipelineTask = schedules.task({
  id: "scrape-pipeline",
  cron: {
    pattern: "0 * * * *", // Uurlijkse due-check; DB cronExpression bepaalt welke platforms echt draaien
    timezone: "Europe/Amsterdam",
  },
  maxDuration: 1800, // 30 minutes — NVB province sharding + werkzoeken Firecrawl fallback need headroom
  machine: { preset: "medium-1x" }, // 1 vCPU, 2 GB RAM — werkzoeken cumulative HTML + Firecrawl responses need headroom
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 60_000,
  },
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
    const scheduleDecisions = new Map<string, ReturnType<typeof getScrapeScheduleDecision>>();

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

      const schedule = getScrapeScheduleDecision(cfg.cronExpression, cfg.lastRunAt);
      scheduleDecisions.set(cfg.platform, schedule);

      if (!schedule.due) {
        skippedSchedule++;
        logger.info("Scrape schedule overgeslagen", {
          platform: cfg.platform,
          schedule,
        });
        trackServerEvent("system", "scrape_schedule_skipped", {
          platform: cfg.platform,
          ...schedule,
        });
        results.push({ platform: cfg.platform, status: "not_due", schedule });
        return false;
      }

      logger.info("Scrape schedule is due", { platform: cfg.platform, schedule });
      return true;
    });

    const settled = await runScrapePipelinesWithConcurrency(eligible);

    for (let i = 0; i < eligible.length; i++) {
      const r = settled[i];
      dispatched++;
      const platform = eligible[i].platform;
      if (r.status === "fulfilled") {
        const scrapeData = {
          platform,
          status: "success",
          schedule: scheduleDecisions.get(platform),
          ...r.value,
        };
        results.push(scrapeData);
        notifySlack("scrape:complete", scrapeData);
        trackServerEvent("system", "scrape_completed", {
          platform,
          ...r.value,
        });
      } else {
        results.push({
          platform,
          status: "failed",
          schedule: scheduleDecisions.get(platform),
          error: String(r.reason),
        });
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
      scheduleDecisions: Object.fromEntries(scheduleDecisions),
    });
    trackServerEvent("system", "scrape_pipeline_completed", {
      dispatched,
      tripped,
      skippedSchedule,
      schedulesEvaluated: scheduleDecisions.size,
    });

    return { dispatched, tripped, skippedSchedule, results };
  },
});
