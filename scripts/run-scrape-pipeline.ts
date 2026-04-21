import { db } from "@motian/db";
import { sql } from "drizzle-orm";
import { runScrapePipeline } from "@/src/services/scrape-pipeline";

const TARGETS = process.env.SCRAPE_TARGETS?.split(",")
  .map((t) => t.trim())
  .filter(Boolean) ?? ["opdrachtoverheid", "werkzoeken", "mipublic"];

type ConfigRow = { platform: string; base_url: string };

async function main() {
  const targetList = sql.join(
    TARGETS.map((t) => sql`${t}`),
    sql`, `,
  );
  const result = await db.execute<ConfigRow>(sql`
    select platform, base_url from scraper_configs
    where platform in (${targetList})
  `);
  const rows = (result as { rows?: ConfigRow[] }).rows ?? (result as unknown as ConfigRow[]);
  const byPlatform = new Map(rows.map((r) => [r.platform, r.base_url]));

  for (const platform of TARGETS) {
    const baseUrl = byPlatform.get(platform);
    if (!baseUrl) {
      console.log(`[${platform}] SKIP — geen config rij gevonden`);
      continue;
    }
    const start = Date.now();
    console.log(`[${platform}] START — base_url=${baseUrl}`);
    try {
      const res = await runScrapePipeline(platform, baseUrl);
      const ms = Date.now() - start;
      console.log(
        `[${platform}] DONE in ${ms}ms — jobsNew=${res.jobsNew} duplicates=${res.duplicates} errors=${res.errors.length}`,
      );
      if (res.errors.length > 0) {
        for (const err of res.errors.slice(0, 5)) {
          console.log(`[${platform}]   ! ${err}`);
        }
      }
    } catch (err) {
      const ms = Date.now() - start;
      console.error(`[${platform}] THROWN in ${ms}ms:`, err);
    }
  }

  const after = await db.execute<{
    platform: string;
    consecutive_failures: number | null;
    last_run_status: string | null;
    last_run_at: string | null;
  }>(sql`
    select platform, consecutive_failures, last_run_status, last_run_at
    from scraper_configs
    where platform in (${targetList})
    order by platform
  `);
  const afterRows = (after as { rows?: unknown[] }).rows ?? (after as unknown as unknown[]);
  console.log("\n=== Post-run state ===");
  console.table(afterRows);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
