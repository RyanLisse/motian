import { db, desc, gte } from "../src/db";
import { scrapeResults, scraperConfigs } from "../src/db/schema";

const SEVEN_DAYS_AGO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

async function main() {
  const recent = await db
    .select({
      platform: scrapeResults.platform,
      status: scrapeResults.status,
      runAt: scrapeResults.runAt,
      errors: scrapeResults.errors,
      durationMs: scrapeResults.durationMs,
      jobsFound: scrapeResults.jobsFound,
      jobsNew: scrapeResults.jobsNew,
    })
    .from(scrapeResults)
    .where(gte(scrapeResults.runAt, SEVEN_DAYS_AGO))
    .orderBy(desc(scrapeResults.runAt));

  type Stat = {
    total: number;
    ok: number;
    failed: number;
    partial: number;
    lastErr?: string;
    lastErrAt?: string;
    lastStatus?: string;
  };
  const byPlatform = new Map<string, Stat>();
  for (const r of recent) {
    const s: Stat = byPlatform.get(r.platform) ?? { total: 0, ok: 0, failed: 0, partial: 0 };
    s.total++;
    if (r.status === "success") s.ok++;
    else if (r.status === "partial") s.partial++;
    else s.failed++;

    if (!s.lastStatus) s.lastStatus = r.status;

    if (r.status !== "success" && !s.lastErr) {
      const errStr = Array.isArray(r.errors)
        ? JSON.stringify(r.errors).slice(0, 300)
        : typeof r.errors === "object" && r.errors !== null
          ? JSON.stringify(r.errors).slice(0, 300)
          : String(r.errors ?? "");
      s.lastErr = errStr;
      s.lastErrAt = r.runAt?.toISOString?.();
    }
    byPlatform.set(r.platform, s);
  }

  console.log("=== PLATFORM STATS (last 7 days) ===");
  const rows = [...byPlatform.entries()]
    .map(([platform, s]) => ({
      platform,
      total: s.total,
      ok: s.ok,
      partial: s.partial,
      failed: s.failed,
      okPct: s.total ? Math.round((s.ok / s.total) * 100) : 0,
      lastErrAt: s.lastErrAt,
      lastErr: s.lastErr?.slice(0, 160),
    }))
    .sort((a, b) => b.failed + b.partial - (a.failed + a.partial));
  console.table(rows);

  console.log("\n=== 30 MOST RECENT NON-SUCCESS RUNS ===");
  const failures = recent.filter((r) => r.status !== "success").slice(0, 30);
  for (const r of failures) {
    const errStr = Array.isArray(r.errors)
      ? JSON.stringify(r.errors)
      : JSON.stringify(r.errors ?? "");
    console.log(
      `- [${r.runAt?.toISOString?.()}] ${r.platform} status=${r.status} dur=${r.durationMs}ms found=${r.jobsFound} new=${r.jobsNew} | ${errStr.slice(0, 300)}`,
    );
  }

  const configs = await db
    .select({
      platform: scraperConfigs.platform,
      isActive: scraperConfigs.isActive,
      consecutiveFailures: scraperConfigs.consecutiveFailures,
      lastRunAt: scraperConfigs.lastRunAt,
      lastRunStatus: scraperConfigs.lastRunStatus,
      validationStatus: scraperConfigs.validationStatus,
      lastValidationError: scraperConfigs.lastValidationError,
    })
    .from(scraperConfigs);

  console.log("\n=== CIRCUIT-BREAKER STATE (tripped when consecutiveFailures >= 5) ===");
  console.table(
    configs.map((c) => ({
      platform: c.platform,
      active: c.isActive,
      consecFails: c.consecutiveFailures,
      tripped: (c.consecutiveFailures ?? 0) >= 5,
      lastRunAt: c.lastRunAt?.toISOString?.(),
      lastRunStatus: c.lastRunStatus,
      valStatus: c.validationStatus,
      valErr: c.lastValidationError?.slice(0, 120),
    })),
  );

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
