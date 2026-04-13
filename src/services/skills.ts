import { candidateSkillsV2, db, eq, inArray, jobSkillsV2, or, skills, sql } from "../db";
import { extractCandidateSkillSeeds, extractJobSkillSeeds } from "./esco-backfill";
import { normalizeAlias } from "./esco-import";

export type CandidateSkillRecord = {
  skillId: string;
  slug: string;
  label: string;
  rawLabel: string | null;
  source: string;
  confidence: number;
};

export type JobSkillRecord = {
  skillId: string;
  slug: string;
  label: string;
  rawLabel: string | null;
  source: string;
  importance: "must" | "nice";
  confidence: number;
};

export type SkillsCatalogStatus = {
  available: boolean;
  issue: "missing_catalog" | null;
  skillCount: number;
  aliasCount: number;
  mappingCount: number;
  jobSkillCount: number;
  candidateSkillCount: number;
  checkedAt: string;
};

export type MapSkillInput = {
  rawSkill: string;
  language?: string;
  contextType: "candidate" | "job" | "tool";
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

export function resetSkillsCatalogStatusCache(): void {
  // no-op: no in-memory cache in the simplified skills service
}

export async function getSkillsCatalogStatusCached(): Promise<SkillsCatalogStatus> {
  return getSkillsCatalogStatus();
}

export async function isSkillsCatalogAvailable(): Promise<boolean> {
  const status = await getSkillsCatalogStatusCached();
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

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeSkillName(value: string): string {
  return normalizeWhitespace(value)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
}

export function toSkillSlug(value: string): string {
  return normalizeAlias(normalizeSkillName(value)).replace(/\s+/g, "-");
}

function toDisplayName(value: string): string {
  return normalizeSkillName(value);
}

export async function findOrCreateSkill(rawName: string) {
  const name = toDisplayName(rawName);
  const slug = toSkillSlug(name);

  if (!slug) {
    throw new Error("Skillnaam mag niet leeg zijn");
  }

  const existing = await db.select().from(skills).where(eq(skills.slug, slug)).limit(1);
  if (existing[0]) return existing[0];

  const inserted = await db
    .insert(skills)
    .values({ slug, name })
    .onConflictDoUpdate({
      target: skills.slug,
      set: {
        updatedAt: sql`now()`,
      },
    })
    .returning();

  return inserted[0];
}

export async function syncCandidateSkillsV2(input: {
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
    const skill = await findOrCreateSkill(seed.rawSkill);
    await db
      .insert(candidateSkillsV2)
      .values({
        candidateId: input.candidateId,
        skillId: skill.id,
        rawLabel: seed.rawSkill,
        source: seed.source,
        confidence: null,
      })
      .onConflictDoUpdate({
        target: [
          candidateSkillsV2.candidateId,
          candidateSkillsV2.skillId,
          candidateSkillsV2.source,
        ],
        set: {
          rawLabel: sql`excluded.raw_label`,
          updatedAt: sql`now()`,
        },
      });
  }
}

export async function syncJobSkillsV2(input: {
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
    const skill = await findOrCreateSkill(seed.rawSkill);
    const importance = seed.source === "job.requirements" ? "must" : "nice";

    await db
      .insert(jobSkillsV2)
      .values({
        jobId: input.jobId,
        skillId: skill.id,
        rawLabel: seed.rawSkill,
        source: seed.source,
        importance,
        confidence: null,
      })
      .onConflictDoUpdate({
        target: [jobSkillsV2.jobId, jobSkillsV2.skillId, jobSkillsV2.source],
        set: {
          rawLabel: sql`excluded.raw_label`,
          importance: sql`excluded.importance`,
          updatedAt: sql`now()`,
        },
      });
  }
}

export async function getCandidateSkillsV2(candidateId: string): Promise<CandidateSkillRecord[]> {
  const rows = await db
    .select({
      skillId: candidateSkillsV2.skillId,
      slug: skills.slug,
      label: skills.name,
      rawLabel: candidateSkillsV2.rawLabel,
      source: candidateSkillsV2.source,
      confidence: candidateSkillsV2.confidence,
    })
    .from(candidateSkillsV2)
    .innerJoin(skills, eq(candidateSkillsV2.skillId, skills.id))
    .where(eq(candidateSkillsV2.candidateId, candidateId));

  return rows.map((row) => ({
    skillId: row.skillId,
    slug: row.slug,
    label: row.label,
    rawLabel: row.rawLabel,
    source: row.source,
    confidence: row.confidence ?? 1,
  }));
}

export async function getCandidateSkillsV2ForCandidateIds(
  candidateIds: string[],
): Promise<Map<string, CandidateSkillRecord[]>> {
  if (candidateIds.length === 0) return new Map();

  const rows = await db
    .select({
      candidateId: candidateSkillsV2.candidateId,
      skillId: candidateSkillsV2.skillId,
      slug: skills.slug,
      label: skills.name,
      rawLabel: candidateSkillsV2.rawLabel,
      source: candidateSkillsV2.source,
      confidence: candidateSkillsV2.confidence,
    })
    .from(candidateSkillsV2)
    .innerJoin(skills, eq(candidateSkillsV2.skillId, skills.id))
    .where(inArray(candidateSkillsV2.candidateId, candidateIds));

  const grouped = new Map<string, CandidateSkillRecord[]>();
  for (const row of rows) {
    const list = grouped.get(row.candidateId) ?? [];
    list.push({
      skillId: row.skillId,
      slug: row.slug,
      label: row.label,
      rawLabel: row.rawLabel,
      source: row.source,
      confidence: row.confidence ?? 1,
    });
    grouped.set(row.candidateId, list);
  }

  return grouped;
}

export async function getJobSkillsV2(jobId: string): Promise<JobSkillRecord[]> {
  const rows = await db
    .select({
      skillId: jobSkillsV2.skillId,
      slug: skills.slug,
      label: skills.name,
      rawLabel: jobSkillsV2.rawLabel,
      source: jobSkillsV2.source,
      importance: jobSkillsV2.importance,
      confidence: jobSkillsV2.confidence,
    })
    .from(jobSkillsV2)
    .innerJoin(skills, eq(jobSkillsV2.skillId, skills.id))
    .where(eq(jobSkillsV2.jobId, jobId));

  return rows.map((row) => ({
    skillId: row.skillId,
    slug: row.slug,
    label: row.label,
    rawLabel: row.rawLabel,
    source: row.source,
    importance: row.importance === "must" ? "must" : "nice",
    confidence: row.confidence ?? 1,
  }));
}

export async function getJobSkillsV2ForJobIds(
  jobIds: string[],
): Promise<Map<string, JobSkillRecord[]>> {
  if (jobIds.length === 0) return new Map();

  const rows = await db
    .select({
      jobId: jobSkillsV2.jobId,
      skillId: jobSkillsV2.skillId,
      slug: skills.slug,
      label: skills.name,
      rawLabel: jobSkillsV2.rawLabel,
      source: jobSkillsV2.source,
      importance: jobSkillsV2.importance,
      confidence: jobSkillsV2.confidence,
    })
    .from(jobSkillsV2)
    .innerJoin(skills, eq(jobSkillsV2.skillId, skills.id))
    .where(inArray(jobSkillsV2.jobId, jobIds));

  const grouped = new Map<string, JobSkillRecord[]>();
  for (const row of rows) {
    const list = grouped.get(row.jobId) ?? [];
    list.push({
      skillId: row.skillId,
      slug: row.slug,
      label: row.label,
      rawLabel: row.rawLabel,
      source: row.source,
      importance: row.importance === "must" ? "must" : "nice",
      confidence: row.confidence ?? 1,
    });
    grouped.set(row.jobId, list);
  }

  return grouped;
}

export async function listSkillsForFilter(query?: string) {
  const normalizedQuery = query ? normalizeSkillName(query).toLocaleLowerCase("nl-NL") : null;
  const baseQuery = db
    .select({
      id: skills.id,
      slug: skills.slug,
      name: skills.name,
    })
    .from(skills);

  const filteredQuery = normalizedQuery
    ? baseQuery.where(
        or(
          sql`lower(${skills.name}) like ${`%${normalizedQuery}%`}`,
          sql`lower(${skills.slug}) like ${`%${normalizedQuery.replace(/\s+/g, "-")}%`}`,
        ),
      )
    : baseQuery;

  return filteredQuery.orderBy(skills.name).limit(query ? 25 : 100);
}

export async function getSkillsCatalogStatus(): Promise<SkillsCatalogStatus> {
  const [skillCountRow, jobSkillCountRow, candidateSkillCountRow] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(skills),
    db.select({ count: sql<number>`count(*)::int` }).from(jobSkillsV2),
    db.select({ count: sql<number>`count(*)::int` }).from(candidateSkillsV2),
  ]);

  const skillCount = skillCountRow[0]?.count ?? 0;
  return {
    available: skillCount > 0,
    issue: skillCount > 0 ? null : "missing_catalog",
    skillCount,
    aliasCount: 0,
    mappingCount: 0,
    jobSkillCount: jobSkillCountRow[0]?.count ?? 0,
    candidateSkillCount: candidateSkillCountRow[0]?.count ?? 0,
    checkedAt: new Date().toISOString(),
  };
}

export async function getSkillsFilterValueExists(slug: string): Promise<boolean> {
  const row = await db.select({ id: skills.id }).from(skills).where(eq(skills.slug, slug)).limit(1);
  return Boolean(row[0]);
}
