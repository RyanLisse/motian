import { and, desc, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { OpdrachtenLayoutShell } from "@/components/opdrachten-layout-shell";
import { OpdrachtenSidebar } from "@/components/opdrachten-sidebar";
import { db } from "@/src/db";
import { applications, jobs } from "@/src/db/schema";
import { DEFAULT_OPDRACHTEN_LIMIT } from "@/src/lib/opdrachten-filters";
import { getJobStatusCondition } from "@/src/services/jobs/filters";

export const dynamic = "force-dynamic";

type PipelineSummaryRow = {
  jobId: string;
  pipelineCount: number;
};

export default async function OpdrachtenLayout({ children }: { children: React.ReactNode }) {
  const activeJobsCondition = getJobStatusCondition("open");
  const persistedEndClient = sql<string | null>`coalesce(${jobs.endClient}, ${jobs.company})`;

  const [sidebarJobRows, countResult, metaResult, categoryRows] = await Promise.all([
    db
      .select({
        id: jobs.id,
        title: jobs.title,
        company: persistedEndClient,
        location: jobs.location,
        platform: jobs.platform,
        workArrangement: jobs.workArrangement,
        contractType: jobs.contractType,
        applicationDeadline: jobs.applicationDeadline,
      })
      .from(jobs)
      .where(activeJobsCondition)
      .orderBy(desc(jobs.scrapedAt))
      .limit(DEFAULT_OPDRACHTEN_LIMIT),
    db.select({ count: sql<number>`count(*)::int` }).from(jobs).where(activeJobsCondition),
    db
      .select({
        platforms: sql<string[]>`array_remove(array_agg(distinct ${jobs.platform}), null)`,
        endClients: sql<string[]>`array_remove(array_agg(distinct ${persistedEndClient}), null)`,
      })
      .from(jobs)
      .where(activeJobsCondition),
    db.execute(sql`
      select distinct jsonb_array_elements_text(coalesce(${jobs.categories}, '[]'::jsonb)) as category
      from ${jobs}
      where ${activeJobsCondition}
      order by category asc
    `),
  ]);

  const jobIds = sidebarJobRows.map((job) => job.id);
  const pipelineRows: PipelineSummaryRow[] =
    jobIds.length === 0
      ? []
      : await db
          .select({
            jobId: sql<string>`${applications.jobId}`,
            pipelineCount: sql<number>`sum(case when ${applications.stage} != 'rejected' then 1 else 0 end)::int`,
          })
          .from(applications)
          .where(
            and(
              inArray(applications.jobId, jobIds),
              isNotNull(applications.jobId),
              isNull(applications.deletedAt),
            ),
          )
          .groupBy(applications.jobId);

  const pipelineCountByJobId = new Map(
    pipelineRows.map((row: PipelineSummaryRow) => [row.jobId, row.pipelineCount]),
  );
  const sidebarJobs = sidebarJobRows.map((job) => ({
    ...job,
    hasPipeline: pipelineCountByJobId.has(job.id),
    pipelineCount: pipelineCountByJobId.get(job.id) ?? 0,
  }));

  const totalCount = countResult[0]?.count ?? 0;
  const platforms = (metaResult[0]?.platforms ?? []).filter(Boolean).sort();
  const endClients = (metaResult[0]?.endClients ?? []).filter(Boolean).sort();
  const categories = (categoryRows.rows as Array<{ category: string | null }>)
    .map((row) => row.category)
    .filter((value): value is string => Boolean(value));

  return (
    <OpdrachtenLayoutShell
      sidebar={
        <OpdrachtenSidebar
          jobs={sidebarJobs}
          totalCount={totalCount}
          platforms={platforms}
          endClients={endClients}
          categories={categories}
        />
      }
    >
      {children}
    </OpdrachtenLayoutShell>
  );
}
