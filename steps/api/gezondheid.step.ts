import { StepConfig, Handlers } from "motia";
import { db } from "../../src/db";
import { scraperConfigs, scrapeResults } from "../../src/db/schema";
import { eq, gte, and, sql } from "drizzle-orm";

export const config = {
  name: "GetGezondheid",
  description: "Platform gezondheid: status per scraper + 24-uurs failure rate",
  triggers: [{ type: "http", method: "GET", path: "/api/gezondheid" }],
  flows: ["recruitment-scraper"],
} as const satisfies StepConfig;

type PlatformHealth = {
  platform: string;
  isActive: boolean;
  lastRunAt: Date | null;
  lastRunStatus: string | null;
  runs24h: number;
  failures24h: number;
  failureRate: number;
  status: "gezond" | "waarschuwing" | "kritiek" | "inactief";
};

export const handler: Handlers<typeof config> = async (_req, { logger }) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Single query: join configs with aggregated results (fixes N+1)
    const configs = await db.select().from(scraperConfigs);
    const statsRows = await db
      .select({
        platform: scrapeResults.platform,
        total: sql<number>`count(*)::int`,
        failures: sql<number>`count(*) filter (where ${scrapeResults.status} = 'failed')::int`,
      })
      .from(scrapeResults)
      .where(gte(scrapeResults.runAt, twentyFourHoursAgo))
      .groupBy(scrapeResults.platform);

    const statsMap = new Map(statsRows.map((s) => [s.platform, s]));

    const health: PlatformHealth[] = configs.map((cfg) => {
      if (!cfg.isActive) {
        return {
          platform: cfg.platform,
          isActive: false,
          lastRunAt: cfg.lastRunAt,
          lastRunStatus: cfg.lastRunStatus,
          runs24h: 0,
          failures24h: 0,
          failureRate: 0,
          status: "inactief" as const,
        };
      }

      const stats = statsMap.get(cfg.platform);
      const runs24h = stats?.total ?? 0;
      const failures24h = stats?.failures ?? 0;
      const failureRate = runs24h > 0 ? failures24h / runs24h : 0;

      let status: PlatformHealth["status"] = "gezond";
      if (failures24h > 3) {
        status = "kritiek";
      } else if (failures24h > 0) {
        status = "waarschuwing";
      }

      return {
        platform: cfg.platform,
        isActive: cfg.isActive,
        lastRunAt: cfg.lastRunAt,
        lastRunStatus: cfg.lastRunStatus,
        runs24h,
        failures24h,
        failureRate: Math.round(failureRate * 100) / 100,
        status,
      };
    });

    return {
      status: 200,
      body: {
        data: health,
        overall:
          health.some((h) => h.status === "kritiek")
            ? "kritiek"
            : health.some((h) => h.status === "waarschuwing")
              ? "waarschuwing"
              : "gezond",
      },
    };
  } catch (err) {
    logger.error(`Fout bij gezondheidscheck: ${String(err)}`);
    return {
      status: 500,
      body: { error: "Interne serverfout" },
    };
  }
};
