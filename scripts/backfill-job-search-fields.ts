import { config as dotenvConfig } from "dotenv";
import { and, asc, eq, gt } from "drizzle-orm";
import { db } from "../src/db";
import { jobs } from "../src/db/schema";
import { deriveJobSearchFields } from "../src/services/normalize";

dotenvConfig({ path: ".env.local" });

type Mode = "preview" | "commit";

function parseArgs(argv: string[]) {
  let limit = Number.POSITIVE_INFINITY;
  let batchSize = 200;
  let platform: string | undefined;
  let mode: Mode = "preview";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--commit") mode = "commit";
    else if (arg === "--limit") limit = Number(argv[index + 1] ?? Number.POSITIVE_INFINITY);
    else if (arg === "--batch-size") batchSize = Number(argv[index + 1] ?? batchSize);
    else if (arg === "--platform") platform = argv[index + 1];
  }

  return { batchSize: Math.max(1, batchSize), limit: Math.max(0, limit), mode, platform };
}

async function fetchBatch(limit: number, platform?: string, afterId?: string) {
  const conditions = [];
  if (platform) conditions.push(eq(jobs.platform, platform));
  if (afterId) conditions.push(gt(jobs.id, afterId));

  return db
    .select({
      id: jobs.id,
      platform: jobs.platform,
      title: jobs.title,
      company: jobs.company,
      endClient: jobs.endClient,
      location: jobs.location,
      province: jobs.province,
      description: jobs.description,
      dedupeTitleNormalized: jobs.dedupeTitleNormalized,
      dedupeClientNormalized: jobs.dedupeClientNormalized,
      dedupeLocationNormalized: jobs.dedupeLocationNormalized,
      searchText: jobs.searchText,
    })
    .from(jobs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(jobs.id))
    .limit(limit);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let inspected = 0;
  let updated = 0;
  let lastId: string | undefined;
  const sample: Array<{ id: string; platform: string; changed: string[] }> = [];

  while (inspected < args.limit) {
    const rows = await fetchBatch(
      Math.min(args.batchSize, args.limit - inspected),
      args.platform,
      lastId,
    );
    if (rows.length === 0) break;

    inspected += rows.length;
    lastId = rows.at(-1)?.id;

    const dirtyRows = rows
      .map((row) => {
        const next = deriveJobSearchFields(row);
        const changed = [
          row.dedupeTitleNormalized !== next.dedupeTitleNormalized && "dedupeTitleNormalized",
          row.dedupeClientNormalized !== next.dedupeClientNormalized && "dedupeClientNormalized",
          row.dedupeLocationNormalized !== next.dedupeLocationNormalized &&
            "dedupeLocationNormalized",
          row.searchText !== next.searchText && "searchText",
        ].filter((value): value is string => Boolean(value));

        return changed.length > 0 ? { changed, id: row.id, next, platform: row.platform } : null;
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    updated += dirtyRows.length;
    sample.push(...dirtyRows.slice(0, Math.max(0, 20 - sample.length)));

    if (args.mode === "commit") {
      await db.transaction(async (tx) => {
        for (const row of dirtyRows) {
          await tx.update(jobs).set(row.next).where(eq(jobs.id, row.id));
        }
      });
    }
  }

  console.log(
    JSON.stringify(
      { inspected, mode: args.mode, platform: args.platform ?? null, updated },
      null,
      2,
    ),
  );
  if (sample.length > 0) console.table(sample);
}

main().catch((error) => {
  console.error("Backfill job search fields failed:", error);
  process.exit(1);
});
