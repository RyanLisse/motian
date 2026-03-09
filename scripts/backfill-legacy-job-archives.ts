import { and, asc, eq, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "../src/db";
import { jobs } from "../src/db/schema";

type Mode = "preview" | "rollback" | "commit";

class RollbackValidation extends Error {}

function usage() {
  console.log(
    `Usage: pnpm tsx scripts/backfill-legacy-job-archives.ts [--limit N] [--platform NAME] [--rollback|--commit]\n\nModes:\n  preview   default, reads a subset only\n  rollback  runs the subset update in a transaction and rolls it back\n  commit    persists the subset update (non-production validation only)`,
  );
}

function parseArgs(argv: string[]) {
  let limit = 10;
  let platform: string | undefined;
  let mode: Mode = "preview";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return { help: true as const };
    if (arg === "--limit") {
      const value = Number.parseInt(argv[i + 1] ?? "", 10);
      if (!Number.isFinite(value) || value <= 0)
        throw new Error("--limit must be a positive integer");
      limit = value;
      i += 1;
      continue;
    }
    if (arg === "--platform") {
      platform = argv[i + 1]?.trim();
      if (!platform) throw new Error("--platform requires a value");
      i += 1;
      continue;
    }
    if (arg === "--rollback") {
      mode = "rollback";
      continue;
    }
    if (arg === "--commit") {
      mode = "commit";
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { help: false as const, limit, mode, platform };
}

function formatTimestamp(value: Date | null) {
  return value?.toISOString() ?? null;
}

async function selectCandidates(limit: number, platform?: string) {
  const conditions = [
    isNotNull(jobs.deletedAt),
    or(ne(jobs.status, "archived"), isNull(jobs.archivedAt)),
  ];

  if (platform) {
    conditions.push(eq(jobs.platform, platform));
  }

  return db
    .select({
      id: jobs.id,
      platform: jobs.platform,
      title: jobs.title,
      status: jobs.status,
      archivedAt: jobs.archivedAt,
      deletedAt: jobs.deletedAt,
    })
    .from(jobs)
    .where(and(...conditions))
    .orderBy(asc(jobs.deletedAt), asc(jobs.scrapedAt))
    .limit(limit);
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    usage();
    return;
  }

  const candidates = await selectCandidates(parsed.limit, parsed.platform);
  console.log(
    JSON.stringify(
      {
        mode: parsed.mode,
        limit: parsed.limit,
        platform: parsed.platform ?? null,
        candidateCount: candidates.length,
      },
      null,
      2,
    ),
  );

  if (candidates.length === 0) return;

  console.table(
    candidates.map((job) => ({
      id: job.id,
      platform: job.platform,
      status: job.status,
      archivedAt: formatTimestamp(job.archivedAt),
      deletedAt: formatTimestamp(job.deletedAt),
      title: job.title.slice(0, 80),
    })),
  );

  if (parsed.mode === "preview") return;

  try {
    await db.transaction(async (tx) => {
      const targetIds = candidates.map((job) => job.id);
      const updated = await tx
        .update(jobs)
        .set({
          status: "archived",
          archivedAt: sql`coalesce(${jobs.archivedAt}, ${jobs.deletedAt})`,
          deletedAt: null,
        })
        .where(and(inArray(jobs.id, targetIds), isNotNull(jobs.deletedAt)))
        .returning({
          id: jobs.id,
          status: jobs.status,
          archivedAt: jobs.archivedAt,
          deletedAt: jobs.deletedAt,
        });

      console.log(`Updated ${updated.length} legacy vacatures in ${parsed.mode} mode.`);

      if (parsed.mode === "rollback") {
        throw new RollbackValidation("Subset validation rolled back intentionally.");
      }
    });
  } catch (error) {
    if (error instanceof RollbackValidation) {
      console.log(error.message);
      return;
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  usage();
  process.exitCode = 1;
});
