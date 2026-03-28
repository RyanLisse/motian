import { and, asc, db, isNull } from "../src/db";
import { candidates, jobs } from "../src/db/schema";
import { getTypesenseConfig } from "../src/lib/typesense";
import { getVisibleVacancyCondition } from "../src/services/jobs/filters";
import {
  ensureTypesenseCollections,
  upsertCandidatesByIds,
  upsertJobsByIds,
} from "../src/services/search-index/typesense-sync";

const BATCH_SIZE = 100;

async function reindexJobs() {
  let offset = 0;
  let processed = 0;

  while (true) {
    const rows = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(getVisibleVacancyCondition())
      .orderBy(asc(jobs.id))
      .limit(BATCH_SIZE)
      .offset(offset);

    if (rows.length === 0) break;

    const ids = rows.map((row) => row.id);
    await upsertJobsByIds(ids);
    processed += ids.length;
    offset += rows.length;
  }

  return processed;
}

async function reindexCandidates() {
  let offset = 0;
  let processed = 0;

  while (true) {
    const rows = await db
      .select({ id: candidates.id })
      .from(candidates)
      .where(and(isNull(candidates.deletedAt)))
      .orderBy(asc(candidates.id))
      .limit(BATCH_SIZE)
      .offset(offset);

    if (rows.length === 0) break;

    const ids = rows.map((row) => row.id);
    await upsertCandidatesByIds(ids);
    processed += ids.length;
    offset += rows.length;
  }

  return processed;
}

async function main() {
  const config = getTypesenseConfig();
  if (!config) {
    throw new Error("Typesense is niet geconfigureerd. Zet TYPESENSE_URL en TYPESENSE_API_KEY.");
  }

  await ensureTypesenseCollections();
  const [jobsProcessed, candidatesProcessed] = await Promise.all([
    reindexJobs(),
    reindexCandidates(),
  ]);

  console.log(
    JSON.stringify(
      {
        jobsProcessed,
        candidatesProcessed,
        collections: config.collections,
      },
      null,
      2,
    ),
  );
}

await main();
