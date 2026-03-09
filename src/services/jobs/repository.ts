import { and, eq, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "../../db";
import { jobs } from "../../db/schema";

export type Job = typeof jobs.$inferSelect;

/** Enkele opdracht ophalen op ID, inclusief gesloten/gearchiveerde retained vacatures. */
export async function getJobById(id: string): Promise<Job | null> {
  const rows = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
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
  const rows = await db.update(jobs).set(data).where(eq(jobs.id, id)).returning();

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
  const rows = await db.update(jobs).set(data).where(eq(jobs.id, id)).returning();

  return rows[0] ?? null;
}

/** Opdracht archiveren. Retourneert true als de status is bijgewerkt. */
export async function deleteJob(id: string): Promise<boolean> {
  const rows = await db
    .update(jobs)
    .set({
      status: "archived",
      archivedAt: sql`coalesce(${jobs.archivedAt}, ${jobs.deletedAt}, now())`,
      deletedAt: null,
    })
    .where(
      and(
        eq(jobs.id, id),
        or(ne(jobs.status, "archived"), isNull(jobs.archivedAt), isNotNull(jobs.deletedAt)),
      ),
    )
    .returning();

  return rows.length > 0;
}
