/**
 * Skills service — canonical skill layer for candidates and jobs.
 *
 * This module re-exports the core skills service and provides enrichment
 * helpers (withCandidateSkills, withJobSkills) used throughout the app.
 *
 * Historical note: this file was previously the ESCO compatibility facade.
 * Consumers still import from "./esco" — a future rename to "./skills-facade"
 * or direct "./skills" imports will complete the migration.
 */
import {
  type CandidateSkillRecord,
  countSkillsForFilter,
  findOrCreateSkill,
  getCandidateSkillsV2,
  getCandidateSkillsV2ForCandidateIds,
  getJobSkillsV2,
  getJobSkillsV2ForJobIds,
  getSkillsCatalogStatus,
  type JobSkillRecord,
  listSkillsForFilter,
  type SkillFilterPageOptions,
  syncCandidateSkillsV2,
  syncJobSkillsV2,
  toSkillSlug,
} from "./skills";

// ========== Types ==========

/** Canonical skill attached to a candidate. */
export type CandidateSkill = {
  skillId: string;
  slug: string;
  label: string;
  confidence: number;
  source: string;
  rawLabel: string | null;
};

/** Canonical skill attached to a job. */
export type JobSkill = {
  skillId: string;
  slug: string;
  label: string;
  confidence: number;
  importance: "must" | "nice";
  required: boolean;
  weight: number;
  source: string;
  rawLabel: string | null;
};

export type JobSkillLite = {
  slug: string;
  label: string;
};

export type WithSkills<T, TSkill> = T & {
  canonicalSkills: TSkill[];
};

export type SkillsCatalogStatus = {
  available: boolean;
  issue: "missing_catalog" | null;
  skillCount: number;
  jobSkillCount: number;
  candidateSkillCount: number;
  checkedAt: string;
};

export type SkillFilterOption = {
  slug: string;
  name: string;
};

export type SkillsMappingStats = {
  totalMappings: number;
  byStrategy: Record<string, number>;
  avgConfidence: number | null;
  sentToReviewCount: number;
  last24hCount: number;
};

export type SkillsReviewQueueSummary = {
  pendingCount: number;
  byContextType: Record<string, number>;
  oldestPendingAt: string | null;
};

// ========== Converters ==========

function toCandidateSkill(record: CandidateSkillRecord): CandidateSkill {
  return {
    skillId: record.skillId,
    slug: record.slug,
    label: record.label,
    confidence: record.confidence,
    source: record.source,
    rawLabel: record.rawLabel,
  };
}

function toJobSkill(record: JobSkillRecord): JobSkill {
  const required = record.importance === "must";
  return {
    skillId: record.skillId,
    slug: record.slug,
    label: record.label,
    confidence: record.confidence,
    importance: record.importance,
    required,
    weight: required ? 1 : 0.6,
    source: record.source,
    rawLabel: record.rawLabel,
  };
}

// ========== Catalog ==========

export function isSkillScoringEnabled(): boolean {
  return process.env.SKILL_SCORING_ENABLED !== "false";
}

export async function getSkillsCatalogStatusCached(): Promise<SkillsCatalogStatus> {
  const status = await getSkillsCatalogStatus();
  return {
    available: status.available,
    issue: status.issue,
    skillCount: status.skillCount,
    jobSkillCount: status.jobSkillCount,
    candidateSkillCount: status.candidateSkillCount,
    checkedAt: status.checkedAt,
  };
}

export async function isSkillsCatalogAvailable(): Promise<boolean> {
  const status = await getSkillsCatalogStatusCached();
  return status.available;
}

// ========== Sync ==========

export async function syncCandidateSkills(input: {
  candidateId: string;
  skills?: unknown;
  skillsStructured?: unknown;
}): Promise<void> {
  await syncCandidateSkillsV2(input);
}

export async function syncJobSkills(input: {
  jobId: string;
  requirements?: unknown;
  wishes?: unknown;
  competences?: unknown;
}): Promise<void> {
  await syncJobSkillsV2(input);
}

// ========== Read ==========

export async function getCandidateSkills(candidateId: string): Promise<CandidateSkill[]> {
  const records = await getCandidateSkillsV2(candidateId);
  return records.map(toCandidateSkill);
}

export async function getJobSkills(jobId: string): Promise<JobSkill[]> {
  const records = await getJobSkillsV2(jobId);
  return records.map(toJobSkill);
}

export async function getJobSkillsForJobIds(jobIds: string[]): Promise<Map<string, JobSkill[]>> {
  const grouped = await getJobSkillsV2ForJobIds(jobIds);
  return new Map(
    Array.from(grouped.entries()).map(([jobId, rows]) => [jobId, rows.map(toJobSkill)]),
  );
}

export async function getCandidateSkillsForCandidateIds(
  candidateIds: string[],
): Promise<Map<string, CandidateSkill[]>> {
  const grouped = await getCandidateSkillsV2ForCandidateIds(candidateIds);
  return new Map(
    Array.from(grouped.entries()).map(([candidateId, rows]) => [
      candidateId,
      rows.map(toCandidateSkill),
    ]),
  );
}

// ========== Enrichment helpers ==========

export async function withCandidateSkills<T extends { id: string }>(
  candidate: T,
): Promise<WithSkills<T, CandidateSkill>> {
  return { ...candidate, canonicalSkills: await getCandidateSkills(candidate.id) };
}

export async function withCandidatesSkills<T extends { id: string }>(
  candidates: T[],
): Promise<Array<WithSkills<T, CandidateSkill>>> {
  const grouped = await getCandidateSkillsForCandidateIds(candidates.map((c) => c.id));
  return candidates.map((c) => ({
    ...c,
    canonicalSkills: grouped.get(c.id) ?? [],
  }));
}

export async function withJobSkills<T extends { id: string }>(
  job: T,
): Promise<WithSkills<T, JobSkill>> {
  return { ...job, canonicalSkills: await getJobSkills(job.id) };
}

export async function withJobsSkills<T extends { id: string }>(
  jobs: T[],
): Promise<Array<WithSkills<T, JobSkill>>> {
  const grouped = await getJobSkillsForJobIds(jobs.map((j) => j.id));
  return jobs.map((j) => ({
    ...j,
    canonicalSkills: grouped.get(j.id) ?? [],
  }));
}

export async function withJobsSkillsLite<T extends { id: string }>(
  jobs: T[],
): Promise<Array<WithSkills<T, JobSkillLite>>> {
  const grouped = await getJobSkillsForJobIds(jobs.map((j) => j.id));
  return jobs.map((j) => ({
    ...j,
    canonicalSkills: (grouped.get(j.id) ?? []).map((s) => ({ slug: s.slug, label: s.label })),
  }));
}

// ========== Filter ==========

export async function listSkillsForFilterOptions(
  query?: string,
  options: SkillFilterPageOptions = {},
): Promise<SkillFilterOption[]> {
  const rows = await listSkillsForFilter(query, options);
  return rows.map((row) => ({ slug: row.slug, name: row.name }));
}

export async function countSkillFilterOptions(query?: string): Promise<number> {
  return countSkillsForFilter(query);
}

export async function getSkillsMappingStats(): Promise<SkillsMappingStats> {
  const status = await getSkillsCatalogStatusCached();
  const totalMappings = status.jobSkillCount + status.candidateSkillCount;
  return {
    totalMappings,
    byStrategy: { exact: totalMappings },
    avgConfidence: totalMappings > 0 ? 1 : null,
    sentToReviewCount: 0,
    last24hCount: 0,
  };
}

export async function getSkillsReviewQueueSummary(): Promise<SkillsReviewQueueSummary> {
  return {
    pendingCount: 0,
    byContextType: {},
    oldestPendingAt: null,
  };
}

// ========== Re-exports for direct access ==========

export { findOrCreateSkill, toSkillSlug };

// ========== Legacy aliases (deprecated — will be removed) ==========

/** @deprecated Use CandidateSkill */
export type CandidateCanonicalSkill = CandidateSkill;
/** @deprecated Use JobSkill */
export type JobCanonicalSkill = JobSkill;
/** @deprecated Use WithSkills */
export type WithCanonicalSkills<T, TSkill> = WithSkills<T, TSkill>;
/** @deprecated Use isSkillScoringEnabled */
export const isEscoScoringEnabled = isSkillScoringEnabled;
/** @deprecated Use getSkillsCatalogStatusCached */
export const getEscoCatalogStatus = getSkillsCatalogStatusCached;
/** @deprecated Use isSkillsCatalogAvailable */
export const isEscoCatalogAvailable = isSkillsCatalogAvailable;
/** @deprecated Use syncCandidateSkills */
export const syncCandidateEscoSkills = syncCandidateSkills;
/** @deprecated Use syncJobSkills */
export const syncJobEscoSkills = syncJobSkills;
/** @deprecated Use getSkillsMappingStats */
export const getEscoMappingStats = getSkillsMappingStats;
/** @deprecated Use getSkillsReviewQueueSummary */
export const getReviewQueueSummary = getSkillsReviewQueueSummary;
/** @deprecated Use listSkillsForFilterOptions */
export async function listEscoSkillsForFilter(query?: string) {
  const rows = await listSkillsForFilter(query);
  return rows.map((row) => ({ uri: row.slug, labelNl: row.name, labelEn: row.name }));
}
/** @deprecated Use withCandidateSkills */
export const withCandidateCanonicalSkills = withCandidateSkills;
/** @deprecated Use withCandidatesSkills */
export const withCandidatesCanonicalSkills = withCandidatesSkills;
/** @deprecated Use withJobSkills */
export const withJobCanonicalSkills = withJobSkills;
/** @deprecated Use withJobsSkills */
export const withJobsCanonicalSkills = withJobsSkills;
