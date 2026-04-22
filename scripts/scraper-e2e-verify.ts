import { and, db, desc, eq, gte } from "../src/db";
import { scrapeResults, scraperConfigs } from "../src/db/schema";
import { runScrapePipeline } from "../src/services/scrape-pipeline";

const platforms = process.argv.slice(2);
if (platforms.length === 0) {
  console.error("usage: tsx scripts/scraper-e2e-verify.ts <platform> [platform...]");
  process.exit(1);
}

async function verifyOne(platform: string) {
  const [config] = await db
    .select({ baseUrl: scraperConfigs.baseUrl, isActive: scraperConfigs.isActive })
    .from(scraperConfigs)
    .where(eq(scraperConfigs.platform, platform))
    .limit(1);

  if (!config) return { platform, error: "no config in scraper_configs" };
  if (!config.isActive) return { platform, error: "inactive" };

  const startTs = Date.now();
  console.log(`  → running ${platform} against ${config.baseUrl}`);
  try {
    const result = await runScrapePipeline(platform, config.baseUrl);
    const wallMs = Date.now() - startTs;

    const [latest] = await db
      .select({
        status: scrapeResults.status,
        durationMs: scrapeResults.durationMs,
        jobsFound: scrapeResults.jobsFound,
        jobsNew: scrapeResults.jobsNew,
        duplicates: scrapeResults.duplicates,
        errors: scrapeResults.errors,
        runAt: scrapeResults.runAt,
      })
      .from(scrapeResults)
      .where(
        and(
          eq(scrapeResults.platform, platform),
          gte(scrapeResults.runAt, new Date(startTs - 5000)),
        ),
      )
      .orderBy(desc(scrapeResults.runAt))
      .limit(1);

    return { platform, wallMs, runResult: result, latest };
  } catch (err) {
    return {
      platform,
      wallMs: Date.now() - startTs,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  console.log(`Running e2e verification for ${platforms.join(", ")}\n`);
  const all: Awaited<ReturnType<typeof verifyOne>>[] = [];
  for (const p of platforms) {
    console.log(`--- ${p} ---`);
    const r = await verifyOne(p);
    all.push(r);
    if ("error" in r && r.error) {
      console.log(`  ERROR  ${r.error}`);
    } else if ("runResult" in r) {
      console.log(
        `  duration=${((r.wallMs ?? 0) / 1000).toFixed(1)}s  runResult.jobsNew=${r.runResult?.jobsNew}  dup=${r.runResult?.duplicates}  errors=${r.runResult?.errors?.length ?? 0}`,
      );
      if (r.latest) {
        const errs = Array.isArray(r.latest.errors)
          ? JSON.stringify(r.latest.errors).slice(0, 200)
          : "";
        console.log(
          `  dbrow: status=${r.latest.status}  found=${r.latest.jobsFound}  new=${r.latest.jobsNew}  dup=${r.latest.duplicates}  ${errs}`,
        );
      } else {
        console.log("  dbrow: (none in last 5s — check recordScrapeResult path)");
      }
    }
  }

  console.log("\n=== Summary ===");
  console.table(
    all.map((r) => ({
      platform: r.platform,
      status: "latest" in r && r.latest ? r.latest.status : "error" in r ? "ERROR" : "?",
      found: "latest" in r && r.latest ? r.latest.jobsFound : 0,
      new: "latest" in r && r.latest ? r.latest.jobsNew : 0,
      durMs: "wallMs" in r ? r.wallMs : 0,
      err: "error" in r ? r.error : undefined,
    })),
  );
  const anyError = all.some(
    (r) => ("error" in r && r.error) || ("latest" in r && r.latest?.status === "failed"),
  );
  process.exit(anyError ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
