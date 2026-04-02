import { and, db, eq, getTableColumns, isNotNull, ne, or, type SQL, sql } from "../../db";
import { jobs } from "../../db/schema";
import { deleteJobsByIds, upsertJobsByIds } from "../search-index/typesense-sync";
import { scheduleDedupeRanksRefresh } from "./dedupe-ranks";

export type Job = typeof jobs.$inferSelect;

function getNormalizedCompatibilityExpression(value: SQL) {
  return sql<string>`trim(regexp_replace(lower(coalesce(${value}, '')), '[^[:alnum:]]+', ' ', 'g'))`;
}

function getSearchTextCompatibilityExpression() {
  return sql<string>`trim(regexp_replace(concat_ws(' ', nullif(trim(coalesce(${jobs.title}, '')), ''), nullif(trim(coalesce(${jobs.company}, '')), ''), nullif(trim(coalesce(${jobs.description}, '')), ''), nullif(trim(coalesce(${jobs.location}, '')), ''), nullif(trim(coalesce(${jobs.province}, '')), '')), '[[:space:]]+', ' ', 'g'))`;
}

/**
 * Backward-compatible read projection.
 *
 * Some environments still run a pre-0014/0015 schema where `jobs.archived_at`
 * and the search/dedupe helper columns have not been added yet. Bare
 * `select()` / `returning()` calls would expand those missing columns and fail
 * the whole page render. We keep the returned shape stable with expressions
 * that work against both schemas until every database has applied the
 * migrations.
 */
export function getJobReadSelection() {
  return {
    ...getTableColumns(jobs),
    dedupeTitleNormalized: getNormalizedCompatibilityExpression(sql`${jobs.title}`),
    dedupeClientNormalized: getNormalizedCompatibilityExpression(
      sql`coalesce(${jobs.endClient}, ${jobs.company}, '')`,
    ),
    dedupeLocationNormalized: getNormalizedCompatibilityExpression(
      sql`coalesce(${jobs.province}, ${jobs.location}, '')`,
    ),
    searchText: getSearchTextCompatibilityExpression(),
    archivedAt: sql<Date | null>`null`,
  };
}

export const jobReadSelection = getJobReadSelection();

async function runJobDerivedSync(jobId: string): Promise<void> {
  try {
    await upsertJobsByIds([jobId]);
  } catch (err) {
    console.error(`[Jobs] Typesense sync error for ${jobId}:`, err);
  }

  scheduleDedupeRanksRefresh();
}

async function runJobDeleteSync(jobIds: string[]): Promise<void> {
  if (jobIds.length === 0) return;

  try {
    await deleteJobsByIds(jobIds);
  } catch (err) {
    console.error(`[Jobs] Typesense delete error for ${jobIds.join(",")}:`, err);
  }

  scheduleDedupeRanksRefresh();
}

/** Enkele opdracht ophalen op ID, inclusief gesloten/gearchiveerde retained vacatures. */
export async function getJobById(id: string): Promise<Job | null> {
  const rows = await db.select(getJobReadSelection()).from(jobs).where(eq(jobs.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Opdracht bijwerken. Retourneert bijgewerkte job of null. */
export async function updateJob(
  id: string,
  data: Partial<
    Pick<
      Job,
      | "title"
      | "description"
      | "location"
      | "rateMin"
      | "rateMax"
      | "contractType"
      | "workArrangement"
    >
  >,
): Promise<Job | null> {
  type JobSearchHelperUpdate = {
    dedupeLocationNormalized?: SQL<string>;
    dedupeTitleNormalized?: SQL<string>;
    searchText?: SQL<string>;
  };

  // Recompute stored helper columns whenever a source field changes.
  // PostgreSQL evaluates SET-clause expressions against pre-update row values, so we
  // inject literal values for updated fields and column refs for unchanged ones.
  const derivedUpdate: JobSearchHelperUpdate = {};

  if ("title" in data) {
    derivedUpdate.dedupeTitleNormalized = getNormalizedCompatibilityExpression(
      sql`${data.title ?? ""}`,
    );
  }

  if ("location" in data) {
    // province is not mutated here; coalesce order mirrors jobReadSelection (province before location)
    derivedUpdate.dedupeLocationNormalized = getNormalizedCompatibilityExpression(
      sql`coalesce(${jobs.province}, ${data.location}, '')`,
    );
  }

  if ("title" in data || "description" in data || "location" in data) {
    const titleVal = "title" in data ? sql`${data.title ?? ""}` : sql`${jobs.title}`;
    const descVal =
      "description" in data ? sql`${data.description ?? ""}` : sql`${jobs.description}`;
    const locationVal = "location" in data ? sql`${data.location ?? ""}` : sql`${jobs.location}`;
    derivedUpdate.searchText = sql<string>`trim(regexp_replace(concat_ws(' ', nullif(trim(coalesce(${titleVal}, '')), ''), nullif(trim(coalesce(${jobs.company}, '')), ''), nullif(trim(coalesce(${descVal}, '')), ''), nullif(trim(coalesce(${locationVal}, '')), ''), nullif(trim(coalesce(${jobs.province}, '')), '')), '[[:space:]]+', ' ', 'g'))`;
  }

  const updateValues: typeof data & JobSearchHelperUpdate = {
    ...data,
    ...derivedUpdate,
  };

  const rows = await db
    .update(jobs)
    .set(updateValues)
    .where(eq(jobs.id, id))
    .returning(getJobReadSelection());

  if (rows[0]?.id) {
    await runJobDerivedSync(rows[0].id);
  }

  return rows[0] ?? null;
}

/** Opdracht verrijken met AI-geëxtraheerde data. Retourneert bijgewerkte job of null. */
export async function updateJobEnrichment(
  id: string,
  data: Partial<
    Pick<
      Job,
      | "educationLevel"
      | "workExperienceYears"
      | "workArrangement"
      | "languages"
      | "durationMonths"
      | "extensionPossible"
      | "descriptionSummary"
      | "categories"
    >
  >,
): Promise<Job | null> {
  const rows = await db
    .update(jobs)
    .set(data)
    .where(eq(jobs.id, id))
    .returning(getJobReadSelection());

  if (rows[0]?.id) {
    await runJobDerivedSync(rows[0].id);
  }

  return rows[0] ?? null;
}

/** Handmatig een vacature aanmaken. Retourneert de nieuwe job. */
export async function createJob(
  data: Pick<Job, "title" | "platform" | "externalId"> &
    Partial<
      Pick<
        Job,
        | "company"
        | "endClient"
        | "description"
        | "location"
        | "province"
        | "rateMin"
        | "rateMax"
        | "contractType"
        | "workArrangement"
        | "externalUrl"
        | "hoursPerWeek"
      >
    >,
): Promise<Job> {
  const rows = await db.insert(jobs).values(data).returning(getJobReadSelection());

  if (rows[0]?.id) {
    await runJobDerivedSync(rows[0].id);
  }

  return rows[0];
}

/** Opdracht archiveren. Retourneert true als de status is bijgewerkt. */
export async function deleteJob(id: string): Promise<boolean> {
  const rows = await db
    .update(jobs)
    .set({
      status: "archived",
      deletedAt: null,
    })
    .where(and(eq(jobs.id, id), or(ne(jobs.status, "archived"), isNotNull(jobs.deletedAt))))
    .returning({ id: jobs.id });

  if (rows.length > 0) {
    await runJobDeleteSync(rows.map((row) => row.id));
  }

  return rows.length > 0;
}
