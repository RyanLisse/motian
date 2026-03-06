import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db";
import { jobs } from "../../db/schema";

export type Job = typeof jobs.$inferSelect;

/** Enkele opdracht ophalen op ID, of null als niet gevonden. */
export async function getJobById(id: string): Promise<Job | null> {
  const rows = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, id), isNull(jobs.deletedAt)))
    .limit(1);
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
  const rows = await db
    .update(jobs)
    .set(data)
    .where(and(eq(jobs.id, id), isNull(jobs.deletedAt)))
    .returning();

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
    .where(and(eq(jobs.id, id), isNull(jobs.deletedAt)))
    .returning();

  return rows[0] ?? null;
}

/** Opdracht soft-deleten. Retourneert true als gevonden en verwijderd. */
export async function deleteJob(id: string): Promise<boolean> {
  const rows = await db
    .update(jobs)
    .set({ deletedAt: new Date() })
    .where(and(eq(jobs.id, id), isNull(jobs.deletedAt)))
    .returning();

  return rows.length > 0;
}
