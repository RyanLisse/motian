import {
  type CandidateSkillRecord,
  findOrCreateSkill,
  getCandidateSkillsV2,
  getCandidateSkillsV2ForCandidateIds,
  getJobSkillsV2,
  getJobSkillsV2ForJobIds,
  getSkillsCatalogStatus,
  type JobSkillRecord,
  listSkillsForFilter,
  syncCandidateSkillsV2,
  syncJobSkillsV2,
  toSkillSlug,
} from "./skills";

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
  strategy: "exact" | "none";
  reviewRequired: boolean;
};

export type CandidateCanonicalSkill = {
  skillId: string;
  slug: string;
  escoUri: string;
  label: string | null;
  confidence: number;
  critical: boolean;
  rawLabel?: string | null;
  source?: string;
};

export type JobCanonicalSkill = {
  skillId: string;
  slug: string;
  escoUri: string;
  label: string | null;
  confidence: number;
  required: boolean;
  critical: boolean;
  weight: number | null;
  importance: "must" | "nice";
  rawLabel?: string | null;
  source?: string;
};

export type WithCanonicalSkills<T, TCanonicalSkill> = T & {
  canonicalSkills: TCanonicalSkill[];
};

export type EscoCatalogIssue = "missing_catalog" | null;

export type EscoCatalogStatus = {
  available: boolean;
  issue: EscoCatalogIssue;
  skillCount: number;
  aliasCount: number;
  mappingCount: number;
  jobSkillCount: number;
  candidateSkillCount: number;
  checkedAt: string;
};

export type EscoMappingStats = {
  totalMappings: number;
  byStrategy: Record<string, number>;
  avgConfidence: number | null;
  sentToReviewCount: number;
  last24hCount: number;
};

export type ReviewQueueSummary = {
  pendingCount: number;
  byContextType: Record<string, number>;
  oldestPendingAt: string | null;
};

function toCandidateCanonicalSkill(record: CandidateSkillRecord): CandidateCanonicalSkill {
  return {
    skillId: record.skillId,
    slug: record.slug,
    escoUri: record.slug,
    label: record.label,
    confidence: record.confidence,
    critical: false,
    rawLabel: record.rawLabel,
    source: record.source,
  };
}

function toJobCanonicalSkill(record: JobSkillRecord): JobCanonicalSkill {
  const required = record.importance === "must";
  return {
    skillId: record.skillId,
    slug: record.slug,
    escoUri: record.slug,
    label: record.label,
    confidence: record.confidence,
    required,
    critical: required,
    weight: required ? 1 : 0.6,
    importance: record.importance,
    rawLabel: record.rawLabel,
    source: record.source,
  };
}

export function resetEscoCatalogStatusCache(): void {
  // no-op; legacy compatibility surface
}

export function isEscoScoringEnabled(): boolean {
  return process.env.ESCO_SCORING_ENABLED !== "false";
}

export async function getEscoCatalogStatus(_opts?: {
  refresh?: boolean;
}): Promise<EscoCatalogStatus> {
  return getSkillsCatalogStatus();
}

export async function isEscoCatalogAvailable(_opts?: { refresh?: boolean }): Promise<boolean> {
  const status = await getEscoCatalogStatus();
  return status.available;
}

export async function mapSkillInput(input: MapSkillInput): Promise<MapSkillResult> {
  const slug = toSkillSlug(input.rawSkill);
  if (!slug) {
    return { escoUri: null, confidence: 0, strategy: "none", reviewRequired: false };
  }

  const skill = await findOrCreateSkill(input.rawSkill);
  return {
    escoUri: skill.slug,
    confidence: 1,
    strategy: "exact",
    reviewRequired: false,
  };
}

export async function syncCandidateEscoSkills(input: {
  candidateId: string;
  skills?: unknown;
  skillsStructured?: unknown;
}): Promise<void> {
  await syncCandidateSkillsV2(input);
}

export async function syncJobEscoSkills(input: {
  jobId: string;
  requirements?: unknown;
  wishes?: unknown;
  competences?: unknown;
}): Promise<void> {
  await syncJobSkillsV2(input);
}

export async function getCandidateSkills(candidateId: string): Promise<CandidateCanonicalSkill[]> {
  const records = await getCandidateSkillsV2(candidateId);
  return records.map(toCandidateCanonicalSkill);
}

export async function getJobSkills(jobId: string): Promise<JobCanonicalSkill[]> {
  const records = await getJobSkillsV2(jobId);
  return records.map(toJobCanonicalSkill);
}

export async function getJobSkillsForJobIds(
  jobIds: string[],
): Promise<Map<string, JobCanonicalSkill[]>> {
  const grouped = await getJobSkillsV2ForJobIds(jobIds);
  return new Map(
    Array.from(grouped.entries()).map(([jobId, rows]) => [jobId, rows.map(toJobCanonicalSkill)]),
  );
}

export async function getCandidateSkillsForCandidateIds(
  candidateIds: string[],
): Promise<Map<string, CandidateCanonicalSkill[]>> {
  const grouped = await getCandidateSkillsV2ForCandidateIds(candidateIds);
  return new Map(
    Array.from(grouped.entries()).map(([candidateId, rows]) => [
      candidateId,
      rows.map(toCandidateCanonicalSkill),
    ]),
  );
}

export async function withCandidateCanonicalSkills<T extends { id: string }>(
  candidate: T,
): Promise<WithCanonicalSkills<T, CandidateCanonicalSkill>> {
  return { ...candidate, canonicalSkills: await getCandidateSkills(candidate.id) };
}

export async function withCandidatesCanonicalSkills<T extends { id: string }>(
  candidates: T[],
): Promise<Array<WithCanonicalSkills<T, CandidateCanonicalSkill>>> {
  const grouped = await getCandidateSkillsForCandidateIds(
    candidates.map((candidate) => candidate.id),
  );
  return candidates.map((candidate) => ({
    ...candidate,
    canonicalSkills: grouped.get(candidate.id) ?? [],
  }));
}

export async function withJobCanonicalSkills<T extends { id: string }>(
  job: T,
): Promise<WithCanonicalSkills<T, JobCanonicalSkill>> {
  return { ...job, canonicalSkills: await getJobSkills(job.id) };
}

export async function withJobsCanonicalSkills<T extends { id: string }>(
  jobs: T[],
): Promise<Array<WithCanonicalSkills<T, JobCanonicalSkill>>> {
  const grouped = await getJobSkillsForJobIds(jobs.map((job) => job.id));
  return jobs.map((job) => ({
    ...job,
    canonicalSkills: grouped.get(job.id) ?? [],
  }));
}

export async function listEscoSkillsForFilter(query?: string) {
  const rows = await listSkillsForFilter(query);
  return rows.map((row) => ({
    uri: row.slug,
    labelNl: row.name,
    labelEn: row.name,
  }));
}

export async function getEscoMappingStats(): Promise<EscoMappingStats> {
  const status = await getEscoCatalogStatus();
  const totalMappings = status.jobSkillCount + status.candidateSkillCount;
  return {
    totalMappings,
    byStrategy: { exact: totalMappings },
    avgConfidence: totalMappings > 0 ? 1 : null,
    sentToReviewCount: 0,
    last24hCount: 0,
  };
}

export async function getReviewQueueSummary(): Promise<ReviewQueueSummary> {
  return {
    pendingCount: 0,
    byContextType: {},
    oldestPendingAt: null,
  };
}
