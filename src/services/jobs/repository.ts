import { and, eq, getTableColumns, isNotNull, ne, or, sql } from "drizzle-orm";
import { db } from "../../db";
import { jobs } from "../../db/schema";

export type Job = typeof jobs.$inferSelect;

/**
 * Backward-compatible read projection.
 *
 * Some environments still run a pre-0014 schema where `jobs.archived_at`
 * and pre-0015 schemas where the dedupe/search support columns have not been
 * added yet. Bare `select()` / `returning()` calls would expand to those
 * missing columns and fail the whole page render. We keep the returned shape
 * stable while projecting compat literals until every database has applied the
 * migrations.
 */
export const jobReadSelection = {
  ...getTableColumns(jobs),
  dedupeTitleNormalized: sql<string>`''`,
  dedupeClientNormalized: sql<string>`''`,
  dedupeLocationNormalized: sql<string>`''`,
  searchText: sql<string>`''`,
  archivedAt: sql<Date | null>`null`,
};

/** Enkele opdracht ophalen op ID, inclusief gesloten/gearchiveerde retained vacatures. */
export async function getJobById(id: string): Promise<Job | null> {
  const rows = await db.select(jobReadSelection).from(jobs).where(eq(jobs.id, id)).limit(1);
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
  const rows = await db.update(jobs).set(data).where(eq(jobs.id, id)).returning(jobReadSelection);

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
  const rows = await db.update(jobs).set(data).where(eq(jobs.id, id)).returning(jobReadSelection);

  return rows[0] ?? null;
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

  return rows.length > 0;
}
