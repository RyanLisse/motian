import { db } from "../db";
import { candidates } from "../db/schema";
import { and, desc, eq, ilike, isNull } from "drizzle-orm";

// ========== Types ==========

export type Candidate = typeof candidates.$inferSelect;

export type SearchCandidatesOptions = {
  query?: string;
  location?: string;
  limit?: number;
};

export type CreateCandidateData = {
  name: string;
  email?: string;
  role?: string;
  skills?: string[];
  location?: string;
  source?: string;
};

// ========== Service Functions ==========

/** Actieve kandidaten ophalen, geordend op aanmaakdatum. Soft-deleted rijen worden uitgesloten. */
export async function listCandidates(limit?: number): Promise<Candidate[]> {
  const safeLimit = Math.min(limit ?? 50, 100);

  return db
    .select()
    .from(candidates)
    .where(isNull(candidates.deletedAt))
    .orderBy(desc(candidates.createdAt))
    .limit(safeLimit);
}

/** Enkele kandidaat ophalen op ID, of null als niet gevonden. */
export async function getCandidateById(
  id: string,
): Promise<Candidate | null> {
  const rows = await db
    .select()
    .from(candidates)
    .where(and(eq(candidates.id, id), isNull(candidates.deletedAt)))
    .limit(1);

  return rows[0] ?? null;
}

/** Kandidaten zoeken op naam en/of locatie (ilike). Soft-deleted rijen worden uitgesloten. */
export async function searchCandidates(
  opts: SearchCandidatesOptions = {},
): Promise<Candidate[]> {
  const limit = Math.min(opts.limit ?? 50, 100);

  const conditions = [isNull(candidates.deletedAt)];

  if (opts.query) {
    conditions.push(ilike(candidates.name, `%${opts.query}%`));
  }

  if (opts.location) {
    conditions.push(ilike(candidates.location, `%${opts.location}%`));
  }

  return db
    .select()
    .from(candidates)
    .where(and(...conditions))
    .orderBy(desc(candidates.createdAt))
    .limit(limit);
}

/** Nieuwe kandidaat aanmaken en teruggeven. */
export async function createCandidate(
  data: CreateCandidateData,
): Promise<Candidate> {
  const rows = await db
    .insert(candidates)
    .values({
      name: data.name,
      email: data.email,
      role: data.role,
      skills: data.skills,
      location: data.location,
      source: data.source,
    })
    .returning();

  return rows[0];
}

/** Kandidaat bijwerken en teruggeven, of null als niet gevonden. */
export async function updateCandidate(
  id: string,
  data: Partial<CreateCandidateData>,
): Promise<Candidate | null> {
  const rows = await db
    .update(candidates)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(candidates.id, id), isNull(candidates.deletedAt)))
    .returning();

  return rows[0] ?? null;
}

/** Kandidaat soft-deleten. Retourneert true als de rij is bijgewerkt. */
export async function deleteCandidate(id: string): Promise<boolean> {
  const rows = await db
    .update(candidates)
    .set({ deletedAt: new Date() })
    .where(and(eq(candidates.id, id), isNull(candidates.deletedAt)))
    .returning();

  return rows.length > 0;
}
