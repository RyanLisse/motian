import { and, db, desc, eq, inArray, isNull, isPostgresDatabase, sql } from "../db";
import { candidateSkills, candidates } from "../db/schema";
import { caseInsensitiveContains, escapeLike, toTsQueryInput } from "../lib/helpers";
import type { ParsedCV } from "../schemas/candidate-intelligence";
import { syncCandidateEscoSkills } from "./esco";

// ========== Types ==========

export type Candidate = typeof candidates.$inferSelect;

export const CANDIDATE_MATCHING_STATUSES = ["open", "in_review", "linked", "no_match"] as const;

export type CandidateMatchingStatus = (typeof CANDIDATE_MATCHING_STATUSES)[number];

export type SearchCandidatesOptions = {
  query?: string;
  location?: string;
  skills?: string;
  role?: string;
  /** Filter by canonical ESCO skill URI (candidate must have this skill in candidate_skills). */
  escoUri?: string;
  limit?: number;
  offset?: number;
};

export type ListCandidatesOptions = {
  limit?: number;
  offset?: number;
};

export type CreateCandidateData = {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  skills?: string[];
  location?: string;
  source?: string;
  linkedinUrl?: string;
  headline?: string;
  profileSummary?: string;
  hourlyRate?: number;
  availability?: string;
  notes?: string;
  experience?: { title: string; company: string; duration: string }[];
  education?: { school: string; degree: string; duration: string }[];
};

export function isCandidateMatchingStatus(value: string): value is CandidateMatchingStatus {
  return CANDIDATE_MATCHING_STATUSES.includes(value as CandidateMatchingStatus);
}

// ========== Service Functions ==========

/** Actieve kandidaten ophalen, geordend op aanmaakdatum. Soft-deleted rijen worden uitgesloten. */
export async function listCandidates(
  limitOrOpts?: number | ListCandidatesOptions,
): Promise<Candidate[]> {
  const opts = typeof limitOrOpts === "number" ? { limit: limitOrOpts } : (limitOrOpts ?? {});
  const safeLimit = Math.min(opts.limit ?? 50, 100);
  const safeOffset = Math.max(0, opts.offset ?? 0);

  return db
    .select()
    .from(candidates)
    .where(isNull(candidates.deletedAt))
    .orderBy(desc(candidates.createdAt))
    .limit(safeLimit)
    .offset(safeOffset);
}

/** Enkele kandidaat ophalen op ID, of null als niet gevonden. */
export async function getCandidateById(id: string): Promise<Candidate | null> {
  const rows = await db
    .select()
    .from(candidates)
    .where(and(eq(candidates.id, id), isNull(candidates.deletedAt)))
    .limit(1);

  return rows[0] ?? null;
}

/** Build FTS or ILIKE condition for candidate name search. */
function candidateNameCondition(query: string) {
  const tsInput = toTsQueryInput(query);
  if (tsInput && isPostgresDatabase()) {
    return sql`to_tsvector('dutch', coalesce(${candidates.name}, '') || ' ' || coalesce(${candidates.role}, '') || ' ' || coalesce(${candidates.location}, '')) @@ to_tsquery('dutch', ${tsInput})`;
  }
  return caseInsensitiveContains(candidates.name, query);
}

/** Kandidaten zoeken op naam en/of locatie (full-text search met ILIKE fallback). */
export async function searchCandidates(opts: SearchCandidatesOptions = {}): Promise<Candidate[]> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const offset = Math.max(0, opts.offset ?? 0);

  const conditions = [isNull(candidates.deletedAt)];

  if (opts.query) {
    conditions.push(candidateNameCondition(opts.query));
  }

  if (opts.location) {
    conditions.push(caseInsensitiveContains(candidates.location, opts.location));
  }

  if (opts.role) {
    conditions.push(caseInsensitiveContains(candidates.role, opts.role));
  }

  if (opts.skills) {
    // Search within the JSON skills array for a case-insensitive match
    // SQLite uses json_each() instead of PostgreSQL's jsonb_array_elements_text()
    conditions.push(
      sql`EXISTS (SELECT 1 FROM json_each(${candidates.skills}) WHERE lower(value) LIKE ${`%${escapeLike(opts.skills).toLocaleLowerCase("nl-NL")}%`} ESCAPE '\\')`,
    );
  }

  if (opts.escoUri) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM ${candidateSkills} WHERE ${candidateSkills.candidateId} = ${candidates.id} AND ${candidateSkills.escoUri} = ${opts.escoUri})`,
    );
  }

  return db
    .select()
    .from(candidates)
    .where(and(...conditions))
    .orderBy(desc(candidates.createdAt))
    .limit(limit)
    .offset(offset);
}

/** Aantal actieve kandidaten met optionele filters. */
export async function countCandidates(
  opts: Omit<SearchCandidatesOptions, "limit" | "offset"> = {},
): Promise<number> {
  const conditions = [isNull(candidates.deletedAt)];

  if (opts.query) {
    conditions.push(candidateNameCondition(opts.query));
  }

  if (opts.location) {
    conditions.push(caseInsensitiveContains(candidates.location, opts.location));
  }

  if (opts.role) {
    conditions.push(caseInsensitiveContains(candidates.role, opts.role));
  }

  if (opts.skills) {
    // Search within the JSON skills array for a case-insensitive match
    // SQLite uses json_each() instead of PostgreSQL's jsonb_array_elements_text()
    conditions.push(
      sql`EXISTS (SELECT 1 FROM json_each(${candidates.skills}) WHERE lower(value) LIKE ${`%${escapeLike(opts.skills).toLocaleLowerCase("nl-NL")}%`} ESCAPE '\\')`,
    );
  }

  if (opts.escoUri) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM ${candidateSkills} WHERE ${candidateSkills.candidateId} = ${candidates.id} AND ${candidateSkills.escoUri} = ${opts.escoUri})`,
    );
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(candidates)
    .where(and(...conditions));

  return count ?? 0;
}

/** Nieuwe kandidaat aanmaken en teruggeven. Genereert embedding op de achtergrond. */
export async function createCandidate(data: CreateCandidateData): Promise<Candidate> {
  const rows = await db
    .insert(candidates)
    .values({
      name: data.name,
      email: data.email,
      phone: data.phone,
      role: data.role,
      skills: data.skills,
      location: data.location,
      source: data.source,
      linkedinUrl: data.linkedinUrl,
      headline: data.headline,
      profileSummary: data.profileSummary,
      hourlyRate: data.hourlyRate,
      availability: data.availability,
      notes: data.notes,
      experience: data.experience,
      education: data.education,
    })
    .returning();

  const candidate = rows[0];

  // Generate embedding (non-fatal, fire-and-forget)
  try {
    const { embedCandidate } = await import("./embedding");
    await embedCandidate(candidate.id);
  } catch (err) {
    console.error(`[Candidates] Embedding error for ${candidate.id}:`, err);
  }

  await syncCandidateEscoSkills({
    candidateId: candidate.id,
    skills: candidate.skills,
  });

  return candidate;
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

  const candidate = rows[0] ?? null;
  if (!candidate) return null;

  await syncCandidateEscoSkills({
    candidateId: candidate.id,
    skills: candidate.skills,
    skillsStructured: candidate.skillsStructured,
  });

  try {
    const { embedCandidate } = await import("./embedding");
    await embedCandidate(candidate.id);
  } catch (err) {
    console.error(`[Candidates] Embedding refresh error for ${candidate.id}:`, err);
  }

  return candidate;
}

export async function updateCandidateMatchingStatus(
  id: string,
  status: CandidateMatchingStatus,
  options: {
    lastMatchedAt?: Date | null;
    matchingStatusUpdatedAt?: Date;
  } = {},
): Promise<Candidate | null> {
  const updates: {
    matchingStatus: CandidateMatchingStatus;
    matchingStatusUpdatedAt: Date;
    updatedAt: Date;
    lastMatchedAt?: Date | null;
  } = {
    matchingStatus: status,
    matchingStatusUpdatedAt: options.matchingStatusUpdatedAt ?? new Date(),
    updatedAt: new Date(),
  };

  if (options.lastMatchedAt !== undefined) {
    updates.lastMatchedAt = options.lastMatchedAt;
  }

  const rows = await db
    .update(candidates)
    .set(updates)
    .where(and(eq(candidates.id, id), isNull(candidates.deletedAt)))
    .returning();

  return rows[0] ?? null;
}

/** Alle actieve (niet-verwijderde) kandidaten ophalen. Hogere limiet voor batch matching. */
export async function listActiveCandidates(limit?: number): Promise<Candidate[]> {
  const safeLimit = Math.min(limit ?? 200, 500);

  return db
    .select()
    .from(candidates)
    .where(isNull(candidates.deletedAt))
    .orderBy(desc(candidates.createdAt))
    .limit(safeLimit);
}

/** Meerdere kandidaten ophalen op ID. Soft-deleted rijen worden uitgesloten. */
export async function getCandidatesByIds(ids: string[]): Promise<Candidate[]> {
  if (ids.length === 0) return [];

  return db
    .select()
    .from(candidates)
    .where(and(inArray(candidates.id, ids), isNull(candidates.deletedAt)));
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

/** Notitie toevoegen aan een kandidaat met timestamp. Bestaande notities blijven behouden. */
export async function addNoteToCandidate(id: string, note: string): Promise<Candidate | null> {
  const timestamp = new Date().toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" });
  const newNote = `[${timestamp}] ${note}`;

  // Single query: append note using SQL CONCAT (avoids extra SELECT)
  const rows = await db
    .update(candidates)
    .set({
      notes: sql`case when ${candidates.notes} is not null then ${candidates.notes} || ${`\n\n${newNote}`} else ${newNote} end`,
      updatedAt: new Date(),
    })
    .where(and(eq(candidates.id, id), isNull(candidates.deletedAt)))
    .returning();

  return rows[0] ?? null;
}

/** Zoek duplicaat-kandidaten op basis van geparsed CV (email-match of naam-match). Bij email-match telt ook een soft-deleted kandidaat: die wordt heropend en teruggegeven. */
export async function findDuplicateCandidate(
  parsed: ParsedCV,
): Promise<{ exact: Candidate | null; similar: Candidate[] }> {
  if (parsed.email) {
    const emailRows = await db
      .select()
      .from(candidates)
      .where(eq(candidates.email, parsed.email))
      .limit(1);

    if (emailRows.length > 0) {
      const row = emailRows[0];
      if (row.deletedAt) {
        const restored = await db
          .update(candidates)
          .set({ deletedAt: null, updatedAt: new Date() })
          .where(eq(candidates.id, row.id))
          .returning();
        return { exact: restored[0] ?? row, similar: [] };
      }
      return { exact: row, similar: [] };
    }
  }

  const nameRows = await db
    .select()
    .from(candidates)
    .where(
      and(caseInsensitiveContains(candidates.name, parsed.name), isNull(candidates.deletedAt)),
    )
    .limit(5);

  return { exact: null, similar: nameRows };
}

/** Verrijk een bestaande kandidaat met geparsede CV-data. Overschrijft alleen lege velden. */
export async function enrichCandidateFromCV(
  candidateId: string,
  parsed: ParsedCV,
  resumeRaw: string,
  resumeUrl?: string,
): Promise<Candidate | null> {
  const existing = await getCandidateById(candidateId);
  if (!existing) return null;

  const updates: Record<string, unknown> = {
    resumeRaw,
    resumeParsedAt: new Date(),
    ...(resumeUrl ? { resumeUrl } : {}),
    profileSummary: parsed.introduction,
    skillsStructured: {
      hard: parsed.skills.hard,
      soft: parsed.skills.soft,
      totalYearsExperience: parsed.totalYearsExperience,
      highestEducationLevel: parsed.highestEducationLevel,
      industries: parsed.industries,
      preferredContractType: parsed.preferredContractType,
      preferredWorkArrangement: parsed.preferredWorkArrangement,
    },
    experience: parsed.experience,
    education: parsed.education,
    certifications: [...parsed.certifications, ...parsed.courses],
    languageSkills: parsed.languages,
    updatedAt: new Date(),
  };

  // Only overwrite null fields — never clobber manually-entered data
  if (!existing.role && parsed.role) updates.role = parsed.role;
  if (!existing.location && parsed.location) updates.location = parsed.location;
  if (!existing.phone && parsed.phone) updates.phone = parsed.phone;
  if (!existing.email && parsed.email) updates.email = parsed.email;
  if (!existing.notes && parsed.introduction) updates.notes = parsed.introduction;
  if (!existing.skills || !Array.isArray(existing.skills) || existing.skills.length === 0) {
    updates.skills = [
      ...parsed.skills.hard.map((s) => s.name),
      ...parsed.skills.soft.map((s) => s.name),
    ];
  }

  const rows = await db
    .update(candidates)
    .set(updates)
    .where(eq(candidates.id, candidateId))
    .returning();

  const candidate = rows[0] ?? null;
  if (!candidate) return null;

  await syncCandidateEscoSkills({
    candidateId: candidate.id,
    skills: candidate.skills,
    skillsStructured: candidate.skillsStructured,
  });

  return candidate;
}
