import { unstable_cache } from "next/cache";
import { and, db, desc, eq, isNull, ne, or, sql } from "@/src/db";
import { applications, candidates, jobMatches, jobs } from "@/src/db/schema";
import { getGradedCandidates } from "@/src/services/grading";
import { getVisibleVacancyCondition } from "@/src/services/jobs/filters";
import { jobReadSelection } from "@/src/services/jobs/repository";

const RELATED_JOB_LIMIT = 4;
const DEFAULT_GRADED_CANDIDATE_LIMIT = 12;

const PIPELINE_STAGE_PRIORITY: Record<string, number> = {
  new: 0,
  screening: 1,
  interview: 2,
  offer: 3,
  hired: 4,
  rejected: 5,
};

const getCachedEndClients = unstable_cache(
  async () => {
    const persistedEndClient = sql<string | null>`coalesce(${jobs.endClient}, ${jobs.company})`;
    return db
      .select({ endClient: persistedEndClient })
      .from(jobs)
      .where(getVisibleVacancyCondition())
      .groupBy(persistedEndClient)
      .orderBy(persistedEndClient);
  },
  ["end-client-filter-options"],
  { revalidate: 300 },
);

const DEFAULT_COCKPIT_LIMIT = 4;

export async function getJobDetailPageData(
  id: string,
  opts: {
    gradedLimit?: number;
    relatedLimit?: number;
    cockpitLimit?: number;
  } = {},
) {
  const relatedLimit = Math.max(1, Math.min(opts.relatedLimit ?? RELATED_JOB_LIMIT, 12));
  const gradedLimit = Math.max(1, Math.min(opts.gradedLimit ?? DEFAULT_GRADED_CANDIDATE_LIMIT, 24));
  const cockpitLimit = Math.max(1, Math.min(opts.cockpitLimit ?? DEFAULT_COCKPIT_LIMIT, 50));
  const rows = await db
    .select(jobReadSelection)
    .from(jobs)
    .where(and(eq(jobs.id, id), getVisibleVacancyCondition()))
    .limit(1);

  const job = rows[0];
  if (!job) return null;

  const companyMatchRank = job.company
    ? sql<number>`case when ${jobs.company} = ${job.company} then 0 else 1 end`
    : sql<number>`1`;
  const relatedScopeConditions = [eq(jobs.platform, job.platform)];
  if (job.company) {
    relatedScopeConditions.unshift(eq(jobs.company, job.company));
  }
  const relatedScopeCondition = or(...relatedScopeConditions);
  const pipelineStageRank = sql<number>`
    case
      when ${applications.stage} = 'new' then ${PIPELINE_STAGE_PRIORITY.new}
      when ${applications.stage} = 'screening' then ${PIPELINE_STAGE_PRIORITY.screening}
      when ${applications.stage} = 'interview' then ${PIPELINE_STAGE_PRIORITY.interview}
      when ${applications.stage} = 'offer' then ${PIPELINE_STAGE_PRIORITY.offer}
      when ${applications.stage} = 'hired' then ${PIPELINE_STAGE_PRIORITY.hired}
      when ${applications.stage} = 'rejected' then ${PIPELINE_STAGE_PRIORITY.rejected}
      else 99
    end
  `;

  const [relatedJobRows, pipelineCounts, recruiterCockpitRows, gradedCandidates, endClientRows] =
    await Promise.all([
      db
        .select({
          ...jobReadSelection,
          companyMatchRank,
        })
        .from(jobs)
        .where(
          and(
            getVisibleVacancyCondition(),
            eq(jobs.status, "open"),
            ne(jobs.id, id),
            relatedScopeCondition,
          ),
        )
        .orderBy(companyMatchRank, desc(jobs.scrapedAt))
        .limit(relatedLimit),
      db
        .select({
          stage: applications.stage,
          count: sql<number>`count(*)::int`,
        })
        .from(applications)
        .where(and(eq(applications.jobId, id), isNull(applications.deletedAt)))
        .groupBy(applications.stage),
      db
        .select({
          id: applications.id,
          stage: applications.stage,
          source: sql<string>`coalesce(${applications.source}, 'manual')`,
          candidateId: candidates.id,
          candidateName: candidates.name,
          candidateRole: candidates.role,
          candidateLocation: candidates.location,
          matchScore: jobMatches.matchScore,
          matchStatus: jobMatches.status,
          createdAt: applications.createdAt,
        })
        .from(applications)
        .leftJoin(candidates, eq(applications.candidateId, candidates.id))
        .leftJoin(jobMatches, eq(applications.matchId, jobMatches.id))
        .where(and(eq(applications.jobId, id), isNull(applications.deletedAt)))
        .orderBy(pipelineStageRank, desc(applications.updatedAt), desc(applications.createdAt))
        .limit(cockpitLimit),
      getGradedCandidates({ jobId: job.id, limit: gradedLimit }),
      getCachedEndClients(),
    ]);

  const relatedJobs = relatedJobRows.map(({ companyMatchRank: _companyMatchRank, ...row }) => row);
  const endClientOptions = [
    ...new Set(
      endClientRows
        .map((row) => row.endClient?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  return {
    job,
    relatedJobs,
    pipelineCounts,
    recruiterCockpitRows,
    gradedCandidates,
    endClientOptions,
  };
}
