import { and, desc, eq, ilike, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { candidateSkills, candidates } from "../db/schema";
import { escapeLike, toTsQueryInput } from "../lib/helpers";
import type { ParsedCV } from "../schemas/candidate-intelligence";
import { syncCandidateEscoSkills } from "./esco";

// ========== Types ==========

export type Candidate = typeof candidates.$inferSelect;
export type CandidateDetail = Pick<
  Candidate,
  | "id"
  | "name"
  | "email"
  | "phone"
  | "role"
  | "location"
  | "skills"
  | "experience"
  | "preferences"
  | "resumeUrl"
  | "linkedinUrl"
  | "headline"
  | "profileSummary"
  | "source"
  | "notes"
  | "hourlyRate"
  | "availability"
  | "skillsStructured"
  | "languageSkills"
>;

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

const CANDIDATE_COLUMNS_WITHOUT_PROFILE_SUMMARY = {
  id: candidates.id,
  name: candidates.name,
  email: candidates.email,
  phone: candidates.phone,
  role: candidates.role,
  location: candidates.location,
  province: candidates.province,
  skills: candidates.skills,
  experience: candidates.experience,
  preferences: candidates.preferences,
  resumeUrl: candidates.resumeUrl,
  linkedinUrl: candidates.linkedinUrl,
  headline: candidates.headline,
  source: candidates.source,
  notes: candidates.notes,
  hourlyRate: candidates.hourlyRate,
  availability: candidates.availability,
  embedding: candidates.embedding,
  resumeRaw: candidates.resumeRaw,
  resumeParsedAt: candidates.resumeParsedAt,
  skillsStructured: candidates.skillsStructured,
  education: candidates.education,
  certifications: candidates.certifications,
  languageSkills: candidates.languageSkills,
  consentGranted: candidates.consentGranted,
  dataRetentionUntil: candidates.dataRetentionUntil,
  createdAt: candidates.createdAt,
  updatedAt: candidates.updatedAt,
  deletedAt: candidates.deletedAt,
} as const;

const CANDIDATE_COLUMNS = {
  ...CANDIDATE_COLUMNS_WITHOUT_PROFILE_SUMMARY,
  profileSummary: candidates.profileSummary,
} as const;

const CANDIDATE_DETAIL_COLUMNS_WITHOUT_PROFILE_SUMMARY = {
  id: candidates.id,
  name: candidates.name,
  email: candidates.email,
  phone: candidates.phone,
  role: candidates.role,
  location: candidates.location,
  skills: candidates.skills,
  experience: candidates.experience,
  preferences: candidates.preferences,
  resumeUrl: candidates.resumeUrl,
  linkedinUrl: candidates.linkedinUrl,
  headline: candidates.headline,
  source: candidates.source,
  notes: candidates.notes,
  hourlyRate: candidates.hourlyRate,
  availability: candidates.availability,
  skillsStructured: candidates.skillsStructured,
  languageSkills: candidates.languageSkills,
} as const;

const CANDIDATE_DETAIL_COLUMNS = {
  ...CANDIDATE_DETAIL_COLUMNS_WITHOUT_PROFILE_SUMMARY,
  profileSummary: candidates.profileSummary,
} as const;

type CandidateProfileSummarySupport = "unknown" | "supported" | "unsupported";

let candidateProfileSummarySupport: CandidateProfileSummarySupport = "unknown";

export function resetCandidateProfileSummaryFallbackCacheForTests() {
  candidateProfileSummarySupport = "unknown";
}

export function isCandidateProfileSummaryMissingColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";

  return (
    (code === "42703" || /column .* does not exist/i.test(message)) &&
    /profile_summary/i.test(message)
  );
}

function withNullProfileSummary<T extends Record<string, unknown>>(
  row: T,
): T & { profileSummary: null } {
  return { ...row, profileSummary: null };
}

type CandidateProfileSummaryFallbackOptions<T> = {
  operation: string;
  execute: (options: { includeProfileSummary: boolean }) => Promise<T>;
};

export async function withCandidateProfileSummaryFallback<T>({
  operation,
  execute,
}: CandidateProfileSummaryFallbackOptions<T>): Promise<T> {
  if (candidateProfileSummarySupport === "unsupported") {
    return execute({ includeProfileSummary: false });
  }

  try {
    const result = await execute({ includeProfileSummary: true });
    candidateProfileSummarySupport = "supported";
    return result;
  } catch (error) {
    if (!isCandidateProfileSummaryMissingColumnError(error)) {
      throw error;
    }

    candidateProfileSummarySupport = "unsupported";
    console.warn(
      `[Candidates] ${operation}: profile_summary ontbreekt in database, degradeer zonder samenvatting.`,
      error instanceof Error ? error.message : error,
    );

    return execute({ includeProfileSummary: false });
  }
}

// ========== Service Functions ==========

/** Actieve kandidaten ophalen, geordend op aanmaakdatum. Soft-deleted rijen worden uitgesloten. */
export async function listCandidates(
  limitOrOpts?: number | ListCandidatesOptions,
): Promise<Candidate[]> {
  const opts = typeof limitOrOpts === "number" ? { limit: limitOrOpts } : (limitOrOpts ?? {});
  const safeLimit = Math.min(opts.limit ?? 50, 100);
  const safeOffset = Math.max(0, opts.offset ?? 0);

  return withCandidateProfileSummaryFallback({
    operation: "listCandidates",
    execute: async ({ includeProfileSummary }): Promise<Candidate[]> => {
      if (includeProfileSummary) {
        return db
          .select(CANDIDATE_COLUMNS)
          .from(candidates)
          .where(isNull(candidates.deletedAt))
          .orderBy(desc(candidates.createdAt))
          .limit(safeLimit)
          .offset(safeOffset);
      }

      const rows = await db
        .select(CANDIDATE_COLUMNS_WITHOUT_PROFILE_SUMMARY)
        .from(candidates)
        .where(isNull(candidates.deletedAt))
        .orderBy(desc(candidates.createdAt))
        .limit(safeLimit)
        .offset(safeOffset);

      return rows.map((row) => withNullProfileSummary(row));
    },
  });
}

/** Enkele kandidaat ophalen op ID, of null als niet gevonden. */
export async function getCandidateById(id: string): Promise<Candidate | null> {
  const rows = await withCandidateProfileSummaryFallback({
    operation: "getCandidateById",
    execute: async ({ includeProfileSummary }): Promise<Candidate[]> => {
      if (includeProfileSummary) {
        return db
          .select(CANDIDATE_COLUMNS)
          .from(candidates)
          .where(and(eq(candidates.id, id), isNull(candidates.deletedAt)))
          .limit(1);
      }

      const result = await db
        .select(CANDIDATE_COLUMNS_WITHOUT_PROFILE_SUMMARY)
        .from(candidates)
        .where(and(eq(candidates.id, id), isNull(candidates.deletedAt)))
        .limit(1);

      return result.map((row) => withNullProfileSummary(row));
    },
  });

  return rows[0] ?? null;
}

/** Detailselect voor kandidaatprofiel zonder harde afhankelijkheid van optionele kolommen. */
export async function getCandidateDetailById(id: string): Promise<CandidateDetail | null> {
  const rows = await withCandidateProfileSummaryFallback({
    operation: "getCandidateDetailById",
    execute: async ({ includeProfileSummary }): Promise<CandidateDetail[]> => {
      if (includeProfileSummary) {
        return db
          .select(CANDIDATE_DETAIL_COLUMNS)
          .from(candidates)
          .where(and(eq(candidates.id, id), isNull(candidates.deletedAt)))
          .limit(1);
      }

      const result = await db
        .select(CANDIDATE_DETAIL_COLUMNS_WITHOUT_PROFILE_SUMMARY)
        .from(candidates)
        .where(and(eq(candidates.id, id), isNull(candidates.deletedAt)))
        .limit(1);

      return result.map((row) => withNullProfileSummary(row));
    },
  });

  return rows[0] ?? null;
}

/** Build FTS or ILIKE condition for candidate name search. */
function candidateNameCondition(query: string) {
  const tsInput = toTsQueryInput(query);
  if (tsInput) {
    return sql`to_tsvector('dutch', coalesce(${candidates.name}, '') || ' ' || coalesce(${candidates.role}, '') || ' ' || coalesce(${candidates.location}, '')) @@ to_tsquery('dutch', ${tsInput})`;
  }
  return ilike(candidates.name, `%${escapeLike(query)}%`);
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
    conditions.push(ilike(candidates.location, `%${escapeLike(opts.location)}%`));
  }

  if (opts.role) {
    conditions.push(ilike(candidates.role, `%${escapeLike(opts.role)}%`));
  }

  if (opts.skills) {
    // Search within the JSONB skills array for a case-insensitive match
    conditions.push(
      sql`EXISTS (SELECT 1 FROM jsonb_array_elements_text(${candidates.skills}) AS s WHERE s ILIKE ${`%${escapeLike(opts.skills)}%`})`,
    );
  }

  if (opts.escoUri) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM ${candidateSkills} WHERE ${candidateSkills.candidateId} = ${candidates.id} AND ${candidateSkills.escoUri} = ${opts.escoUri})`,
    );
  }

  return withCandidateProfileSummaryFallback({
    operation: "searchCandidates",
    execute: async ({ includeProfileSummary }): Promise<Candidate[]> => {
      if (includeProfileSummary) {
        return db
          .select(CANDIDATE_COLUMNS)
          .from(candidates)
          .where(and(...conditions))
          .orderBy(desc(candidates.createdAt))
          .limit(limit)
          .offset(offset);
      }

      const rows = await db
        .select(CANDIDATE_COLUMNS_WITHOUT_PROFILE_SUMMARY)
        .from(candidates)
        .where(and(...conditions))
        .orderBy(desc(candidates.createdAt))
        .limit(limit)
        .offset(offset);

      return rows.map((row) => withNullProfileSummary(row));
    },
  });
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
    conditions.push(ilike(candidates.location, `%${escapeLike(opts.location)}%`));
  }

  if (opts.role) {
    conditions.push(ilike(candidates.role, `%${escapeLike(opts.role)}%`));
  }

  if (opts.skills) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM jsonb_array_elements_text(${candidates.skills}) AS s WHERE s ILIKE ${`%${escapeLike(opts.skills)}%`})`,
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
  const rows = await withCandidateProfileSummaryFallback({
    operation: "createCandidate",
    execute: async ({ includeProfileSummary }): Promise<Candidate[]> => {
      if (includeProfileSummary) {
        return db
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
          .returning(CANDIDATE_COLUMNS);
      }

      const result = await db
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
          hourlyRate: data.hourlyRate,
          availability: data.availability,
          notes: data.notes,
          experience: data.experience,
          education: data.education,
        })
        .returning(CANDIDATE_COLUMNS_WITHOUT_PROFILE_SUMMARY);

      return result.map((row) => withNullProfileSummary(row));
    },
  });

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
  const rows = await withCandidateProfileSummaryFallback({
    operation: "updateCandidate",
    execute: async ({ includeProfileSummary }): Promise<Candidate[]> => {
      const { profileSummary, ...rest } = data;
      if (includeProfileSummary) {
        return db
          .update(candidates)
          .set({
            ...rest,
            profileSummary,
            updatedAt: new Date(),
          })
          .where(and(eq(candidates.id, id), isNull(candidates.deletedAt)))
          .returning(CANDIDATE_COLUMNS);
      }

      const result = await db
        .update(candidates)
        .set({
          ...rest,
          updatedAt: new Date(),
        })
        .where(and(eq(candidates.id, id), isNull(candidates.deletedAt)))
        .returning(CANDIDATE_COLUMNS_WITHOUT_PROFILE_SUMMARY);

      return result.map((row) => withNullProfileSummary(row));
    },
  });

  const candidate = rows[0] ?? null;
  if (!candidate) return null;

  await syncCandidateEscoSkills({
    candidateId: candidate.id,
    skills: candidate.skills,
    skillsStructured: candidate.skillsStructured,
  });

  return candidate;
}

/** Alle actieve (niet-verwijderde) kandidaten ophalen. Hogere limiet voor batch matching. */
export async function listActiveCandidates(limit?: number): Promise<Candidate[]> {
  const safeLimit = Math.min(limit ?? 200, 500);

  return withCandidateProfileSummaryFallback({
    operation: "listActiveCandidates",
    execute: async ({ includeProfileSummary }): Promise<Candidate[]> => {
      if (includeProfileSummary) {
        return db
          .select(CANDIDATE_COLUMNS)
          .from(candidates)
          .where(isNull(candidates.deletedAt))
          .orderBy(desc(candidates.createdAt))
          .limit(safeLimit);
      }

      const rows = await db
        .select(CANDIDATE_COLUMNS_WITHOUT_PROFILE_SUMMARY)
        .from(candidates)
        .where(isNull(candidates.deletedAt))
        .orderBy(desc(candidates.createdAt))
        .limit(safeLimit);

      return rows.map((row) => withNullProfileSummary(row));
    },
  });
}

/** Meerdere kandidaten ophalen op ID. Soft-deleted rijen worden uitgesloten. */
export async function getCandidatesByIds(ids: string[]): Promise<Candidate[]> {
  if (ids.length === 0) return [];

  return withCandidateProfileSummaryFallback({
    operation: "getCandidatesByIds",
    execute: async ({ includeProfileSummary }): Promise<Candidate[]> => {
      if (includeProfileSummary) {
        return db
          .select(CANDIDATE_COLUMNS)
          .from(candidates)
          .where(and(inArray(candidates.id, ids), isNull(candidates.deletedAt)));
      }

      const rows = await db
        .select(CANDIDATE_COLUMNS_WITHOUT_PROFILE_SUMMARY)
        .from(candidates)
        .where(and(inArray(candidates.id, ids), isNull(candidates.deletedAt)));

      return rows.map((row) => withNullProfileSummary(row));
    },
  });
}

/** Kandidaat soft-deleten. Retourneert true als de rij is bijgewerkt. */
export async function deleteCandidate(id: string): Promise<boolean> {
  const result = await db
    .update(candidates)
    .set({ deletedAt: new Date() })
    .where(and(eq(candidates.id, id), isNull(candidates.deletedAt)));

  return (result.rowCount ?? 0) > 0;
}

/** Notitie toevoegen aan een kandidaat met timestamp. Bestaande notities blijven behouden. */
export async function addNoteToCandidate(id: string, note: string): Promise<Candidate | null> {
  const timestamp = new Date().toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" });
  const newNote = `[${timestamp}] ${note}`;

  // Single query: append note using SQL CONCAT (avoids extra SELECT)
  const rows = await withCandidateProfileSummaryFallback({
    operation: "addNoteToCandidate",
    execute: async ({ includeProfileSummary }): Promise<Candidate[]> => {
      if (includeProfileSummary) {
        return db
          .update(candidates)
          .set({
            notes: sql`case when ${candidates.notes} is not null then ${candidates.notes} || ${`\n\n${newNote}`} else ${newNote} end`,
            updatedAt: new Date(),
          })
          .where(and(eq(candidates.id, id), isNull(candidates.deletedAt)))
          .returning(CANDIDATE_COLUMNS);
      }

      const result = await db
        .update(candidates)
        .set({
          notes: sql`case when ${candidates.notes} is not null then ${candidates.notes} || ${`\n\n${newNote}`} else ${newNote} end`,
          updatedAt: new Date(),
        })
        .where(and(eq(candidates.id, id), isNull(candidates.deletedAt)))
        .returning(CANDIDATE_COLUMNS_WITHOUT_PROFILE_SUMMARY);

      return result.map((row) => withNullProfileSummary(row));
    },
  });

  return rows[0] ?? null;
}

/** Zoek duplicaat-kandidaten op basis van geparsed CV (email-match of naam-match). */
export async function findDuplicateCandidate(
  parsed: ParsedCV,
): Promise<{ exact: Candidate | null; similar: Candidate[] }> {
  // 1. Try exact match by email (unique index: uq_candidates_email)
  if (parsed.email) {
    const email = parsed.email;
    const emailRows = await withCandidateProfileSummaryFallback({
      operation: "findDuplicateCandidate.email",
      execute: async ({ includeProfileSummary }): Promise<Candidate[]> => {
        if (includeProfileSummary) {
          return db
            .select(CANDIDATE_COLUMNS)
            .from(candidates)
            .where(and(eq(candidates.email, email), isNull(candidates.deletedAt)))
            .limit(1);
        }

        const result = await db
          .select(CANDIDATE_COLUMNS_WITHOUT_PROFILE_SUMMARY)
          .from(candidates)
          .where(and(eq(candidates.email, email), isNull(candidates.deletedAt)))
          .limit(1);

        return result.map((row) => withNullProfileSummary(row));
      },
    });

    if (emailRows.length > 0) {
      return { exact: emailRows[0], similar: [] };
    }
  }

  // 2. Fuzzy match by name (ILIKE)
  const nameRows = await withCandidateProfileSummaryFallback({
    operation: "findDuplicateCandidate.name",
    execute: async ({ includeProfileSummary }): Promise<Candidate[]> => {
      if (includeProfileSummary) {
        return db
          .select(CANDIDATE_COLUMNS)
          .from(candidates)
          .where(
            and(ilike(candidates.name, `%${escapeLike(parsed.name)}%`), isNull(candidates.deletedAt)),
          )
          .limit(5);
      }

      const result = await db
        .select(CANDIDATE_COLUMNS_WITHOUT_PROFILE_SUMMARY)
        .from(candidates)
        .where(
          and(ilike(candidates.name, `%${escapeLike(parsed.name)}%`), isNull(candidates.deletedAt)),
        )
        .limit(5);

      return result.map((row) => withNullProfileSummary(row));
    },
  });

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
