import { createHash } from "node:crypto";
import { and, db, desc, eq, getTableColumns, inArray, isNull, sql } from "../db";
import { candidateSkillsV2, candidates, skills } from "../db/schema";
import { queueDeferredEmbeddingSync } from "../lib/event-bus";
import { caseInsensitiveContains, escapeLike, toTsQueryInput } from "../lib/helpers";
import { LIST_SLO_MS, logSlowQuery, SEARCH_SLO_MS } from "../lib/query-observability";
import type { ParsedCV } from "../schemas/candidate-intelligence";
import { emitAgentEvent } from "./agent-events";
import { type EmbeddingStatus, withPendingEmbeddingStatus } from "./embedding";
import { syncCandidateSkills } from "./esco";
import { searchCandidateIdsByTypesense } from "./search-index/typesense-search";
import { deleteCandidatesByIds, upsertCandidatesByIds } from "./search-index/typesense-sync";

// ========== Types ==========

export type Candidate = typeof candidates.$inferSelect;
export type CandidateMutationResult = Candidate & { embeddingStatus: EmbeddingStatus };

/**
 * Backward-compatible read projection.
 *
 * Some environments still run a candidates table without `photo_url`.
 * Bare `select()` / `returning()` calls would expand that missing column and
 * fail otherwise healthy recruiter routes. Keep the returned shape stable until
 * every database has the column.
 */
export function getCandidateReadSelection() {
  return {
    ...getTableColumns(candidates),
    photoUrl: sql<string | null>`null`,
  };
}

export const candidateReadSelection = getCandidateReadSelection();

export const CANDIDATE_MATCHING_STATUSES = ["open", "in_review", "linked", "no_match"] as const;

export type CandidateMatchingStatus = (typeof CANDIDATE_MATCHING_STATUSES)[number];

export type SearchCandidatesOptions = {
  query?: string;
  location?: string;
  skills?: string;
  role?: string;
  availability?: string;
  /** Filter by canonical skill slug (candidate must have this skill in candidate_skills_v2). */
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
  photoUrl?: string;
  headline?: string;
  profileSummary?: string;
  hourlyRate?: number;
  availability?: string;
  notes?: string;
  experience?: { title: string; company: string; duration: string }[];
  education?: { school: string; degree: string; duration: string }[];
};

function getSearchTelemetryMeta(query: string | undefined) {
  const trimmedQuery = query?.trim() ?? "";
  const queryLength = trimmedQuery.length;
  const queryTokenCount = trimmedQuery.length > 0 ? trimmedQuery.split(/\s+/).length : 0;

  if (trimmedQuery.length === 0) {
    return {
      queryFingerprint: null,
      queryLength,
      queryTokenCount,
    };
  }

  return {
    queryFingerprint: createHash("sha256").update(trimmedQuery).digest("hex").slice(0, 16),
    queryLength,
    queryTokenCount,
  };
}

export function isCandidateMatchingStatus(value: string): value is CandidateMatchingStatus {
  return CANDIDATE_MATCHING_STATUSES.includes(value as CandidateMatchingStatus);
}

// ========== Service Functions ==========

/** Actieve kandidaten ophalen, geordend op aanmaakdatum. Soft-deleted rijen worden uitgesloten. */
export async function listCandidates(
  limitOrOpts?: number | ListCandidatesOptions,
): Promise<Candidate[]> {
  const start = Date.now();
  const opts = typeof limitOrOpts === "number" ? { limit: limitOrOpts } : (limitOrOpts ?? {});
  const safeLimit = Math.min(opts.limit ?? 50, 100);
  const safeOffset = Math.max(0, opts.offset ?? 0);

  const rows = await db
    .select(candidateReadSelection)
    .from(candidates)
    .where(isNull(candidates.deletedAt))
    .orderBy(desc(candidates.createdAt))
    .limit(safeLimit)
    .offset(safeOffset);

  logSlowQuery("listCandidates", Date.now() - start, LIST_SLO_MS, {
    limit: safeLimit,
    offset: safeOffset,
    total: rows.length,
    queryPath: "candidate-list",
  });

  return rows;
}

/** Enkele kandidaat ophalen op ID, of null als niet gevonden. */
export async function getCandidateById(id: string): Promise<Candidate | null> {
  const rows = await db
    .select(candidateReadSelection)
    .from(candidates)
    .where(and(eq(candidates.id, id), isNull(candidates.deletedAt)))
    .limit(1);

  return rows[0] ?? null;
}

/** Build FTS or ILIKE condition for candidate name search. */
function candidateNameCondition(query: string) {
  const tsInput = toTsQueryInput(query);
  if (tsInput) {
    return sql`to_tsvector('dutch', coalesce(${candidates.name}, '') || ' ' || coalesce(${candidates.role}, '') || ' ' || coalesce(${candidates.location}, '')) @@ to_tsquery('dutch', ${tsInput})`;
  }
  return caseInsensitiveContains(candidates.name, query);
}

function candidateSkillsCondition(skillsQuery: string) {
  const pattern = `%${escapeLike(skillsQuery).toLocaleLowerCase("nl-NL")}%`;
  return sql`EXISTS (SELECT 1 FROM jsonb_array_elements_text(${candidates.skills}::jsonb) AS t(value) WHERE lower(t.value) LIKE ${pattern} ESCAPE '\\')`;
}

function buildCandidateSearchConditions(
  opts: Omit<SearchCandidatesOptions, "limit" | "offset"> = {},
) {
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
    conditions.push(candidateSkillsCondition(opts.skills));
  }

  if (opts.availability) {
    conditions.push(eq(candidates.availability, opts.availability));
  }

  if (opts.escoUri) {
    conditions.push(
      sql`EXISTS (
        SELECT 1
        FROM ${candidateSkillsV2}
        INNER JOIN ${skills} ON ${candidateSkillsV2.skillId} = ${skills.id}
        WHERE ${candidateSkillsV2.candidateId} = ${candidates.id}
          AND ${skills.slug} = ${opts.escoUri}
      )`,
    );
  }

  return conditions;
}

/** Check whether a candidate has enough data to trigger auto-matching. */
function candidateHasMatchableData(candidate: Candidate): boolean {
  const skills = candidate.skills as unknown;
  return Array.isArray(skills) && skills.length > 0;
}

/**
 * Emit a candidate.parsed event so the existing matcher pipeline picks up
 * newly created or updated candidates — not only those from CV uploads.
 * Only fires when the candidate has skills (guard against stub records).
 */
async function emitAutoMatchEventIfReady(candidate: Candidate): Promise<void> {
  if (!candidateHasMatchableData(candidate)) return;

  try {
    await emitAgentEvent({
      sourceAgent: "intake",
      eventType: "candidate.parsed",
      candidateId: candidate.id,
      payload: {
        trigger: "service",
        skillCount: (candidate.skills as unknown[])?.length ?? 0,
      },
    });
  } catch (err) {
    console.error(`[Candidates] Auto-match event error for ${candidate.id}:`, err);
  }
}

async function runCandidateSkillSync(candidate: Candidate): Promise<void> {
  try {
    await syncCandidateSkills({
      candidateId: candidate.id,
      skills: candidate.skills,
      skillsStructured: candidate.skillsStructured,
    });
  } catch (err) {
    console.error(`[Candidates] Skill sync error for ${candidate.id}:`, err);
  }
}

/** Kandidaten zoeken op naam en/of locatie (full-text search met ILIKE fallback). */
export async function searchCandidates(opts: SearchCandidatesOptions = {}): Promise<Candidate[]> {
  const start = Date.now();
  const limit = Math.min(opts.limit ?? 50, 100);
  const offset = Math.max(0, opts.offset ?? 0);
  const queryTelemetry = getSearchTelemetryMeta(opts.query);
  let typesenseSearchMs = 0;
  let hydrateMs = 0;
  let dbSearchMs = 0;
  let fallbackReason: "typesense-unavailable" | "typesense-zero-hits" | null = null;

  try {
    const typesenseSearchStartedAt = Date.now();
    const externalResult = await searchCandidateIdsByTypesense({ ...opts, limit, offset });
    typesenseSearchMs = Date.now() - typesenseSearchStartedAt;
    if (externalResult && externalResult.ids.length > 0) {
      const hydrateStartedAt = Date.now();
      const hydrated = await getCandidatesByIds(externalResult.ids);
      hydrateMs = Date.now() - hydrateStartedAt;
      const candidatesById = new Map(hydrated.map((candidate) => [candidate.id, candidate]));
      const result = externalResult.ids
        .map((id) => candidatesById.get(id))
        .filter((candidate): candidate is Candidate => Boolean(candidate));

      logSlowQuery("searchCandidates", Date.now() - start, SEARCH_SLO_MS, {
        limit,
        offset,
        total: externalResult.total,
        results: result.length,
        typesenseSearchMs,
        hydrateMs,
        dbSearchMs,
        fallbackReason,
        queryPath: "candidate-search-typesense",
        ...queryTelemetry,
      });

      return result;
    }
    // Zero hits from Typesense: fall through to PostgreSQL (cold index).
    fallbackReason = "typesense-zero-hits";
  } catch {
    // Fall back to PostgreSQL search when Typesense is unavailable.
    fallbackReason = "typesense-unavailable";
  }

  const conditions = buildCandidateSearchConditions(opts);
  const dbSearchStartedAt = Date.now();
  const result = await db
    .select(candidateReadSelection)
    .from(candidates)
    .where(and(...conditions))
    .orderBy(desc(candidates.createdAt))
    .limit(limit)
    .offset(offset);
  dbSearchMs = Date.now() - dbSearchStartedAt;

  logSlowQuery("searchCandidates", Date.now() - start, SEARCH_SLO_MS, {
    limit,
    offset,
    total: result.length,
    results: result.length,
    typesenseSearchMs,
    hydrateMs,
    dbSearchMs,
    fallbackReason,
    queryPath: "candidate-search-db",
    ...queryTelemetry,
  });

  return result;
}

/** Aantal actieve kandidaten met optionele filters. */
export async function countCandidates(
  opts: Omit<SearchCandidatesOptions, "limit" | "offset"> = {},
): Promise<number> {
  const start = Date.now();
  const queryTelemetry = getSearchTelemetryMeta(opts.query);
  let typesenseSearchMs = 0;
  let dbSearchMs = 0;
  let fallbackReason: "typesense-unavailable" | "typesense-zero-hits" | null = null;

  try {
    const typesenseSearchStartedAt = Date.now();
    const externalResult = await searchCandidateIdsByTypesense(opts);
    typesenseSearchMs = Date.now() - typesenseSearchStartedAt;
    if (externalResult && externalResult.total > 0) {
      logSlowQuery("countCandidates", Date.now() - start, LIST_SLO_MS, {
        total: externalResult.total,
        results: externalResult.total,
        typesenseSearchMs,
        dbSearchMs,
        fallbackReason,
        queryPath: "candidate-count-typesense",
        ...queryTelemetry,
      });
      return externalResult.total;
    }
    fallbackReason = "typesense-zero-hits";
  } catch {
    // Fall back to PostgreSQL counting when Typesense is unavailable.
    fallbackReason = "typesense-unavailable";
  }

  const conditions = buildCandidateSearchConditions(opts);
  const dbSearchStartedAt = Date.now();

  const [{ count }] = await db
    .select({ count: sql<number>`CAST(count(*) AS INTEGER)` })
    .from(candidates)
    .where(and(...conditions));
  dbSearchMs = Date.now() - dbSearchStartedAt;

  logSlowQuery("countCandidates", Date.now() - start, LIST_SLO_MS, {
    total: count ?? 0,
    results: count ?? 0,
    typesenseSearchMs,
    dbSearchMs,
    fallbackReason,
    queryPath: "candidate-count-db",
    ...queryTelemetry,
  });

  return count ?? 0;
}

/** Nieuwe kandidaat aanmaken en teruggeven. Genereert embedding op de achtergrond. */
export async function createCandidate(data: CreateCandidateData): Promise<CandidateMutationResult> {
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
      photoUrl: data.photoUrl,
      headline: data.headline,
      profileSummary: data.profileSummary,
      hourlyRate: data.hourlyRate,
      availability: data.availability,
      notes: data.notes,
      experience: data.experience,
      education: data.education,
    })
    .returning(candidateReadSelection);

  const candidate = rows[0];
  await runCandidateSkillSync(candidate);
  void queueDeferredEmbeddingSync({
    entityType: "candidate",
    entityId: candidate.id,
    source: "candidate:create",
  });
  await emitAutoMatchEventIfReady(candidate);

  return withPendingEmbeddingStatus(candidate);
}

/** Kandidaat bijwerken en teruggeven, of null als niet gevonden. */
export async function updateCandidate(
  id: string,
  data: Partial<CreateCandidateData>,
): Promise<CandidateMutationResult | null> {
  const rows = await db
    .update(candidates)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(candidates.id, id), isNull(candidates.deletedAt)))
    .returning(candidateReadSelection);

  const candidate = rows[0] ?? null;
  if (!candidate) return null;
  await runCandidateSkillSync(candidate);
  void queueDeferredEmbeddingSync({
    entityType: "candidate",
    entityId: candidate.id,
    source: "candidate:update",
  });
  await emitAutoMatchEventIfReady(candidate);

  return withPendingEmbeddingStatus(candidate);
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
    .returning(candidateReadSelection);

  if (rows[0]?.id) {
    try {
      await upsertCandidatesByIds([rows[0].id]);
    } catch (err) {
      console.error(`[Candidates] Typesense sync error for ${rows[0].id}:`, err);
    }
  }

  return rows[0] ?? null;
}

/** Alle actieve (niet-verwijderde) kandidaten ophalen. Hogere limiet voor batch matching. */
export async function listActiveCandidates(limit?: number): Promise<Candidate[]> {
  const start = Date.now();
  const safeLimit = Math.min(limit ?? 200, 500);

  const rows = await db
    .select(candidateReadSelection)
    .from(candidates)
    .where(isNull(candidates.deletedAt))
    .orderBy(desc(candidates.createdAt))
    .limit(safeLimit);

  logSlowQuery("listActiveCandidates", Date.now() - start, LIST_SLO_MS, {
    limit: safeLimit,
    total: rows.length,
    queryPath: "candidate-active-list",
  });

  return rows;
}

/** Meerdere kandidaten ophalen op ID. Soft-deleted rijen worden uitgesloten. */
export async function getCandidatesByIds(ids: string[]): Promise<Candidate[]> {
  if (ids.length === 0) return [];

  return db
    .select(candidateReadSelection)
    .from(candidates)
    .where(and(inArray(candidates.id, ids), isNull(candidates.deletedAt)));
}

/** Kandidaat soft-deleten. Retourneert true als de rij is bijgewerkt. */
export async function deleteCandidate(id: string): Promise<boolean> {
  const rows = await db
    .update(candidates)
    .set({ deletedAt: new Date() })
    .where(and(eq(candidates.id, id), isNull(candidates.deletedAt)))
    .returning(candidateReadSelection);

  if (rows.length > 0) {
    try {
      await deleteCandidatesByIds([id]);
    } catch (err) {
      console.error(`[Candidates] Typesense delete error for ${id}:`, err);
    }
  }

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
    .returning(candidateReadSelection);

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
          .returning(candidateReadSelection);
        if (restored[0]?.id) {
          await upsertCandidatesByIds([restored[0].id]);
        }
        return { exact: restored[0] ?? row, similar: [] };
      }
      return { exact: row, similar: [] };
    }
  }

  const nameRows = await db
    .select(candidateReadSelection)
    .from(candidates)
    .where(and(caseInsensitiveContains(candidates.name, parsed.name), isNull(candidates.deletedAt)))
    .limit(5);

  return { exact: null, similar: nameRows };
}

/** Verrijk een bestaande kandidaat met geparsede CV-data. Overschrijft alleen lege velden. */
export async function enrichCandidateFromCV(
  candidateId: string,
  parsed: ParsedCV,
  resumeRaw: string,
  resumeUrl?: string,
): Promise<CandidateMutationResult | null> {
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
    .returning(candidateReadSelection);

  const candidate = rows[0] ?? null;
  if (!candidate) return null;

  await runCandidateSkillSync(candidate);
  void queueDeferredEmbeddingSync({
    entityType: "candidate",
    entityId: candidate.id,
    source: "candidate:cv-enrichment",
  });

  return withPendingEmbeddingStatus(candidate);
}
