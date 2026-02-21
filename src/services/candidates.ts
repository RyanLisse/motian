import { db } from "../db";
import { candidates } from "../db/schema";
import { and, desc, eq, ilike, isNull, sql } from "drizzle-orm";

// ========== Types ==========

export type Candidate = typeof candidates.$inferSelect;

export type CreateCandidateData = {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  skills?: string[];
  experience?: string;
  location?: string;
  province?: string;
  resumeUrl?: string;
  tags?: string[];
  source?: string;
  gdprConsent?: boolean;
};

export type UpdateCandidateData = Partial<CreateCandidateData> & {
  embedding?: string;
};

export type SearchCandidatesOptions = {
  query?: string;
  location?: string;
  limit?: number;
};

// ========== Service Functions ==========

export async function listCandidates(limit = 50): Promise<Candidate[]> {
  return db
    .select()
    .from(candidates)
    .where(isNull(candidates.deletedAt))
    .orderBy(desc(candidates.createdAt))
    .limit(Math.min(limit, 100));
}

export async function getCandidateById(id: string): Promise<Candidate | null> {
  const [result] = await db
    .select()
    .from(candidates)
    .where(and(eq(candidates.id, id), isNull(candidates.deletedAt)))
    .limit(1);
  return result ?? null;
}

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

export async function createCandidate(
  data: CreateCandidateData,
): Promise<Candidate> {
  const [result] = await db
    .insert(candidates)
    .values({
      ...data,
      skills: data.skills ?? [],
      tags: data.tags ?? [],
      gdprConsentAt: data.gdprConsent ? new Date() : undefined,
    })
    .returning();
  return result;
}

export async function updateCandidate(
  id: string,
  data: UpdateCandidateData,
): Promise<Candidate | null> {
  const [result] = await db
    .update(candidates)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(candidates.id, id), isNull(candidates.deletedAt)))
    .returning();
  return result ?? null;
}

/** GDPR-compliant deletion: anonymize PII, keep record for audit trail */
export async function deleteCandidateWithGdpr(
  id: string,
): Promise<boolean> {
  const [result] = await db
    .update(candidates)
    .set({
      name: "[verwijderd]",
      email: null,
      phone: null,
      role: null,
      skills: [],
      experience: null,
      location: null,
      province: null,
      resumeUrl: null,
      embedding: null,
      tags: [],
      source: null,
      gdprConsent: false,
      gdprConsentAt: null,
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(candidates.id, id), isNull(candidates.deletedAt)))
    .returning();
  return !!result;
}

export async function getCandidateStats() {
  const [totalResult] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(candidates)
    .where(isNull(candidates.deletedAt));

  const bySource = await db
    .select({
      source: candidates.source,
      count: sql<number>`count(*)::int`,
    })
    .from(candidates)
    .where(isNull(candidates.deletedAt))
    .groupBy(candidates.source)
    .orderBy(desc(sql`count(*)`));

  return { total: totalResult?.total ?? 0, bySource };
}
