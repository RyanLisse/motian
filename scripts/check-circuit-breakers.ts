// Ops helper: print circuit-breaker state for the configured scrapers.
// Usage: `pnpm tsx scripts/check-circuit-breakers.ts` (after sourcing .env.local).
// Override with SCRAPE_TARGETS="a,b" to inspect a different subset.
import { db } from "@motian/db";
import { sql } from "drizzle-orm";

const TARGETS = process.env.SCRAPE_TARGETS?.split(",")
  .map((t) => t.trim())
  .filter(Boolean) ?? ["opdrachtoverheid", "werkzoeken", "werkzoeken.nl", "mipublic"];

type Row = {
  platform: string;
  is_active: boolean;
  consecutive_failures: number | null;
  last_run_status: string | null;
  last_run_at: string | null;
  last_validated_at: string | null;
  validation_status: string | null;
};

async function main() {
  const placeholders = sql.join(
    TARGETS.map((t) => sql`${t}`),
    sql`, `,
  );
  const result = await db.execute<Row>(sql`
    select platform, is_active, consecutive_failures, last_run_status,
           last_run_at, last_validated_at, validation_status
    from scraper_configs
    where platform in (${placeholders})
    order by platform
  `);

  const rows = (result as { rows?: Row[] }).rows ?? (result as unknown as Row[]);

  if (!rows || rows.length === 0) {
    console.log("Geen rijen voor gerichte platforms. Volledige lijst:");
    const all = await db.execute<Row>(sql`
      select platform, is_active, consecutive_failures, last_run_status, last_run_at
      from scraper_configs order by platform
    `);
    console.table((all as { rows?: unknown[] }).rows ?? all);
    return;
  }

  console.table(
    rows.map((r) => ({
      platform: r.platform,
      isActive: r.is_active,
      consecutiveFailures: r.consecutive_failures ?? 0,
      breakerOpen: (r.consecutive_failures ?? 0) >= 5,
      lastRunStatus: r.last_run_status,
      lastRunAt: r.last_run_at,
      validationStatus: r.validation_status,
    })),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
