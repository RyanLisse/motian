import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "../db";
import { candidateSkills, escoSkills, jobSkills, skillAliases, skillMappings } from "../db/schema";
import { extractCandidateSkillSeeds, extractJobSkillSeeds } from "./esco-backfill";
import { normalizeAlias } from "./esco-import";

const ESCO_VERSION = process.env.ESCO_VERSION ?? "v1.0";
const CRITICAL_REVIEW_THRESHOLD = Number(process.env.ESCO_CRITICAL_REVIEW_THRESHOLD ?? "0.7");

export type MapSkillContextType = "candidate" | "job" | "tool";

export type MapSkillInput = {
  rawSkill: string;
  language?: string;
  contextType: MapSkillContextType;
  contextId: string;
  critical: boolean;
  source?: string;
};

export type MapSkillResult = {
  escoUri: string | null;
  confidence: number;
  strategy: "alias" | "exact" | "semantic" | "none";
  reviewRequired: boolean;
};

export type CandidateCanonicalSkill = {
  escoUri: string;
  label: string | null;
  confidence: number;
  critical: boolean;
};

export type JobCanonicalSkill = {
  escoUri: string;
  label: string | null;
  confidence: number;
  required: boolean;
  critical: boolean;
  weight: number | null;
};

export type WithCanonicalSkills<T, TCanonicalSkill> = T & {
  canonicalSkills: TCanonicalSkill[];
};

function normalizeRawSkill(raw: string): string {
  return normalizeAlias(raw);
}

export function isEscoScoringEnabled(): boolean {
  return process.env.ESCO_SCORING_ENABLED !== "false";
}

export async function mapSkillInput(input: MapSkillInput): Promise<MapSkillResult> {
  const normalized = normalizeRawSkill(input.rawSkill);
  if (!normalized) {
    await persistMapping(input, null, "none", 0, false);
    return { escoUri: null, confidence: 0, strategy: "none", reviewRequired: false };
  }

  const language = input.language ?? "nl";

  const aliasRows = await db
    .select({
      escoUri: skillAliases.escoUri,
      confidence: skillAliases.confidence,
    })
    .from(skillAliases)
    .where(
      and(
        eq(skillAliases.normalizedAlias, normalized),
        sql`(${skillAliases.language} IS NULL OR ${skillAliases.language} = ${language})`,
      ),
    )
    .limit(1);

  if (aliasRows.length > 0) {
    const alias = aliasRows[0];
    const confidence = alias.confidence ?? 0.9;
    const reviewRequired = input.critical && confidence < CRITICAL_REVIEW_THRESHOLD;
    await persistMapping(input, alias.escoUri, "alias", confidence, reviewRequired);
    return {
      escoUri: alias.escoUri,
      confidence,
      strategy: "alias",
      reviewRequired,
    };
  }

  const exactRows = await db
    .select({ uri: escoSkills.uri })
    .from(escoSkills)
    .where(
      or(
        ilike(escoSkills.preferredLabelEn, input.rawSkill.trim()),
        ilike(escoSkills.preferredLabelNl, input.rawSkill.trim()),
      ),
    )
    .limit(1);

  if (exactRows.length > 0) {
    const confidence = 0.95;
    const reviewRequired = input.critical && confidence < CRITICAL_REVIEW_THRESHOLD;
    await persistMapping(input, exactRows[0].uri, "exact", confidence, reviewRequired);
    return {
      escoUri: exactRows[0].uri,
      confidence,
      strategy: "exact",
      reviewRequired,
    };
  }

  await persistMapping(input, null, "none", 0, input.critical);
  return {
    escoUri: null,
    confidence: 0,
    strategy: "none",
    reviewRequired: input.critical,
  };
}

/** Audit log of mapping attempts (one row per call; no unique constraint for deduplication). */
async function persistMapping(
  input: MapSkillInput,
  escoUri: string | null,
  strategy: MapSkillResult["strategy"],
  confidence: number,
  reviewRequired: boolean,
): Promise<void> {
  await db
    .insert(skillMappings)
    .values({
      rawSkill: input.rawSkill,
      normalizedSkill: normalizeRawSkill(input.rawSkill),
      escoUri,
      contextType: input.contextType,
      contextId: input.contextId,
      source: input.source ?? input.contextType,
      strategy,
      confidence: confidence || null,
      critical: input.critical,
      sentToReview: reviewRequired,
      reviewStatus: reviewRequired ? "pending" : null,
      escoVersion: ESCO_VERSION,
    })
    .onConflictDoNothing();
}

export async function upsertCandidateSkill(
  candidateId: string,
  escoUri: string,
  source: string,
  opts: { confidence?: number; evidence?: string; critical?: boolean; strategy?: string },
): Promise<void> {
  await db
    .insert(candidateSkills)
    .values({
      candidateId,
      escoUri,
      source,
      confidence: opts.confidence ?? null,
      evidence: opts.evidence ?? null,
      critical: opts.critical ?? false,
      mappingStrategy: opts.strategy ?? null,
      escoVersion: ESCO_VERSION,
    })
    .onConflictDoUpdate({
      target: [candidateSkills.candidateId, candidateSkills.escoUri, candidateSkills.source],
      set: {
        confidence: sql`excluded.confidence`,
        evidence: sql`excluded.evidence`,
        critical: sql`excluded.critical`,
        mappingStrategy: sql`excluded.mapping_strategy`,
        updatedAt: sql`now()`,
      },
    });
}

export async function upsertJobSkill(
  jobId: string,
  escoUri: string,
  source: string,
  opts: {
    confidence?: number;
    evidence?: string;
    required?: boolean;
    critical?: boolean;
    weight?: number;
    strategy?: string;
  },
): Promise<void> {
  await db
    .insert(jobSkills)
    .values({
      jobId,
      escoUri,
      source,
      confidence: opts.confidence ?? null,
      evidence: opts.evidence ?? null,
      required: opts.required ?? false,
      critical: opts.critical ?? false,
      weight: opts.weight ?? null,
      mappingStrategy: opts.strategy ?? null,
      escoVersion: ESCO_VERSION,
    })
    .onConflictDoUpdate({
      target: [jobSkills.jobId, jobSkills.escoUri, jobSkills.source],
      set: {
        confidence: sql`excluded.confidence`,
        evidence: sql`excluded.evidence`,
        required: sql`excluded.required`,
        critical: sql`excluded.critical`,
        weight: sql`excluded.weight`,
        mappingStrategy: sql`excluded.mapping_strategy`,
        updatedAt: sql`now()`,
      },
    });
}

export async function syncCandidateEscoSkills(input: {
  candidateId: string;
  skills?: unknown;
  skillsStructured?: unknown;
}): Promise<void> {
  const seeds = extractCandidateSkillSeeds({
    skills: input.skills,
    skillsStructured:
      typeof input.skillsStructured === "object" && input.skillsStructured !== null
        ? (input.skillsStructured as {
            hard?: Array<{ name?: string; evidence?: string }>;
            soft?: Array<{ name?: string; evidence?: string }>;
          })
        : null,
  });

  for (const seed of seeds) {
    const mapped = await mapSkillInput({
      rawSkill: seed.rawSkill,
      contextType: "candidate",
      contextId: input.candidateId,
      critical: seed.critical,
      source: seed.source,
    });

    if (!mapped.escoUri) continue;

    await upsertCandidateSkill(input.candidateId, mapped.escoUri, seed.source, {
      confidence: mapped.confidence,
      evidence: seed.evidence,
      critical: seed.critical,
      strategy: mapped.strategy,
    });
  }
}

export async function syncJobEscoSkills(input: {
  jobId: string;
  requirements?: unknown;
  wishes?: unknown;
  competences?: unknown;
}): Promise<void> {
  const seeds = extractJobSkillSeeds({
    requirements: Array.isArray(input.requirements) ? input.requirements : [],
    wishes: Array.isArray(input.wishes) ? input.wishes : [],
    competences: Array.isArray(input.competences) ? input.competences : [],
  });

  for (const seed of seeds) {
    const mapped = await mapSkillInput({
      rawSkill: seed.rawSkill,
      contextType: "job",
      contextId: input.jobId,
      critical: seed.critical,
      source: seed.source,
    });

    if (!mapped.escoUri) continue;

    await upsertJobSkill(input.jobId, mapped.escoUri, seed.source, {
      confidence: mapped.confidence,
      evidence: seed.evidence,
      required: seed.source === "job.requirements",
      critical: seed.critical,
      weight: seed.critical ? 1.5 : seed.source === "job.requirements" ? 1 : 0.6,
      strategy: mapped.strategy,
    });
  }
}

export async function getCandidateSkills(candidateId: string): Promise<CandidateCanonicalSkill[]> {
  const rows = await db
    .select({
      escoUri: candidateSkills.escoUri,
      label: sql<
        string | null
      >`coalesce(${escoSkills.preferredLabelNl}, ${escoSkills.preferredLabelEn})`,
      confidence: candidateSkills.confidence,
      critical: candidateSkills.critical,
    })
    .from(candidateSkills)
    .innerJoin(escoSkills, eq(candidateSkills.escoUri, escoSkills.uri))
    .where(eq(candidateSkills.candidateId, candidateId));

  return rows.map((row) => ({
    escoUri: row.escoUri,
    label: row.label,
    confidence: row.confidence ?? 0,
    critical: row.critical ?? false,
  }));
}

export async function getJobSkills(jobId: string): Promise<JobCanonicalSkill[]> {
  const rows = await db
    .select({
      escoUri: jobSkills.escoUri,
      label: sql<
        string | null
      >`coalesce(${escoSkills.preferredLabelNl}, ${escoSkills.preferredLabelEn})`,
      confidence: jobSkills.confidence,
      required: jobSkills.required,
      critical: jobSkills.critical,
      weight: jobSkills.weight,
    })
    .from(jobSkills)
    .innerJoin(escoSkills, eq(jobSkills.escoUri, escoSkills.uri))
    .where(eq(jobSkills.jobId, jobId));

  return rows.map((row) => ({
    escoUri: row.escoUri,
    label: row.label,
    confidence: row.confidence ?? 0,
    required: row.required ?? false,
    critical: row.critical ?? false,
    weight: row.weight ?? null,
  }));
}

export async function getJobSkillsForJobIds(
  jobIds: string[],
): Promise<Map<string, JobCanonicalSkill[]>> {
  if (jobIds.length === 0) return new Map();

  const rows = await db
    .select({
      jobId: jobSkills.jobId,
      escoUri: jobSkills.escoUri,
      label: sql<
        string | null
      >`coalesce(${escoSkills.preferredLabelNl}, ${escoSkills.preferredLabelEn})`,
      confidence: jobSkills.confidence,
      required: jobSkills.required,
      critical: jobSkills.critical,
      weight: jobSkills.weight,
    })
    .from(jobSkills)
    .innerJoin(escoSkills, eq(jobSkills.escoUri, escoSkills.uri))
    .where(inArray(jobSkills.jobId, jobIds));

  const mapped = new Map<string, JobCanonicalSkill[]>();
  for (const row of rows) {
    const skills = mapped.get(row.jobId) ?? [];
    skills.push({
      escoUri: row.escoUri,
      label: row.label,
      confidence: row.confidence ?? 0,
      required: row.required ?? false,
      critical: row.critical ?? false,
      weight: row.weight ?? null,
    });
    mapped.set(row.jobId, skills);
  }

  return mapped;
}

/** Batch load candidate skills for many candidates (for job→candidates auto-match). */
export async function getCandidateSkillsForCandidateIds(
  candidateIds: string[],
): Promise<Map<string, CandidateCanonicalSkill[]>> {
  if (candidateIds.length === 0) return new Map();

  const rows = await db
    .select({
      candidateId: candidateSkills.candidateId,
      escoUri: candidateSkills.escoUri,
      label: sql<
        string | null
      >`coalesce(${escoSkills.preferredLabelNl}, ${escoSkills.preferredLabelEn})`,
      confidence: candidateSkills.confidence,
      critical: candidateSkills.critical,
    })
    .from(candidateSkills)
    .innerJoin(escoSkills, eq(candidateSkills.escoUri, escoSkills.uri))
    .where(inArray(candidateSkills.candidateId, candidateIds));

  const mapped = new Map<string, CandidateCanonicalSkill[]>();
  for (const row of rows) {
    const skills = mapped.get(row.candidateId) ?? [];
    skills.push({
      escoUri: row.escoUri,
      label: row.label,
      confidence: row.confidence ?? 0,
      critical: row.critical ?? false,
    });
    mapped.set(row.candidateId, skills);
  }

  return mapped;
}

export async function withCandidateCanonicalSkills<T extends { id: string }>(
  candidate: T,
): Promise<WithCanonicalSkills<T, CandidateCanonicalSkill>> {
  const canonicalSkills = await getCandidateSkills(candidate.id);
  return { ...candidate, canonicalSkills };
}

export async function withCandidatesCanonicalSkills<T extends { id: string }>(
  candidates: T[],
): Promise<Array<WithCanonicalSkills<T, CandidateCanonicalSkill>>> {
  if (candidates.length === 0) return [];

  const skillsByCandidateId = await getCandidateSkillsForCandidateIds(
    candidates.map((candidate) => candidate.id),
  );

  return candidates.map((candidate) => ({
    ...candidate,
    canonicalSkills: skillsByCandidateId.get(candidate.id) ?? [],
  }));
}

export async function withJobCanonicalSkills<T extends { id: string }>(
  job: T,
): Promise<WithCanonicalSkills<T, JobCanonicalSkill>> {
  const canonicalSkills = await getJobSkills(job.id);
  return { ...job, canonicalSkills };
}

export async function withJobsCanonicalSkills<T extends { id: string }>(
  jobs: T[],
): Promise<Array<WithCanonicalSkills<T, JobCanonicalSkill>>> {
  if (jobs.length === 0) return [];

  const skillsByJobId = await getJobSkillsForJobIds(jobs.map((job) => job.id));

  return jobs.map((job) => ({
    ...job,
    canonicalSkills: skillsByJobId.get(job.id) ?? [],
  }));
}

// ========== Observability ==========

export type EscoMappingStats = {
  totalMappings: number;
  byStrategy: Record<string, number>;
  avgConfidence: number | null;
  sentToReviewCount: number;
  last24hCount: number;
};

export async function getEscoMappingStats(): Promise<EscoMappingStats> {
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const [totals, byStrategy, reviewCount, last24h] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(skillMappings),
    db
      .select({
        strategy: skillMappings.strategy,
        count: sql<number>`count(*)::int`,
      })
      .from(skillMappings)
      .groupBy(skillMappings.strategy),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(skillMappings)
      .where(
        and(
          eq(skillMappings.sentToReview, true),
          sql`(${skillMappings.reviewStatus} IS NULL OR ${skillMappings.reviewStatus} = 'pending')`,
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(skillMappings)
      .where(sql`${skillMappings.createdAt} >= ${oneDayAgo}`),
  ]);

  const [avgRow] = await db
    .select({
      avg: sql<number | null>`avg(${skillMappings.confidence})::float`,
    })
    .from(skillMappings)
    .where(sql`${skillMappings.confidence} IS NOT NULL`);

  const byStrategyMap: Record<string, number> = {};
  for (const row of byStrategy) {
    byStrategyMap[row.strategy] = row.count;
  }

  return {
    totalMappings: totals[0]?.count ?? 0,
    byStrategy: byStrategyMap,
    avgConfidence: avgRow?.avg ?? null,
    sentToReviewCount: reviewCount[0]?.count ?? 0,
    last24hCount: last24h[0]?.count ?? 0,
  };
}

export type ReviewQueueSummary = {
  pendingCount: number;
  byContextType: Record<string, number>;
  oldestCreatedAt: string | null;
};

export async function getReviewQueueSummary(): Promise<ReviewQueueSummary> {
  const pending = and(
    eq(skillMappings.sentToReview, true),
    sql`(${skillMappings.reviewStatus} IS NULL OR ${skillMappings.reviewStatus} = 'pending')`,
  );

  const [countResult, byContext, oldest] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(skillMappings).where(pending),
    db
      .select({
        contextType: skillMappings.contextType,
        count: sql<number>`count(*)::int`,
      })
      .from(skillMappings)
      .where(pending)
      .groupBy(skillMappings.contextType),
    db
      .select({ createdAt: skillMappings.createdAt })
      .from(skillMappings)
      .where(pending)
      .orderBy(skillMappings.createdAt)
      .limit(1),
  ]);

  const byContextMap: Record<string, number> = {};
  for (const row of byContext) {
    byContextMap[row.contextType] = row.count;
  }

  return {
    pendingCount: countResult[0]?.count ?? 0,
    byContextType: byContextMap,
    oldestCreatedAt: oldest[0]?.createdAt?.toISOString() ?? null,
  };
}

export type EscoSkillOption = {
  uri: string;
  labelNl: string | null;
  labelEn: string;
};

/** List ESCO skills for filter dropdowns; optional search on preferred labels. */
export async function listEscoSkillsForFilter(searchQuery?: string): Promise<EscoSkillOption[]> {
  const baseQuery = db
    .select({
      uri: escoSkills.uri,
      preferredLabelNl: escoSkills.preferredLabelNl,
      preferredLabelEn: escoSkills.preferredLabelEn,
    })
    .from(escoSkills)
    .orderBy(escoSkills.preferredLabelNl ?? escoSkills.preferredLabelEn)
    .limit(200);

  if (searchQuery?.trim()) {
    const term = `%${searchQuery.trim().toLowerCase()}%`;
    const rows = await baseQuery.where(
      or(
        sql`lower(${escoSkills.preferredLabelEn}) LIKE ${term}`,
        sql`lower(${escoSkills.preferredLabelNl}) LIKE ${term}`,
      ),
    );
    return rows.map((r) => ({
      uri: r.uri,
      labelNl: r.preferredLabelNl,
      labelEn: r.preferredLabelEn,
    }));
  }

  const rows = await baseQuery;

  return rows.map((r) => ({
    uri: r.uri,
    labelNl: r.preferredLabelNl,
    labelEn: r.preferredLabelEn,
  }));
}
