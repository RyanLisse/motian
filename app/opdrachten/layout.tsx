import { and, gte, sql } from "drizzle-orm";
import { OpdrachtenLayoutShell } from "@/components/opdrachten-layout-shell";
import { OpdrachtenSidebar } from "@/components/opdrachten-sidebar";
import { db } from "@/src/db";
import { jobs } from "@/src/db/schema";
import { DEFAULT_OPDRACHTEN_LIMIT } from "@/src/lib/opdrachten-filters";
import { listEscoSkillsForFilter } from "@/src/services/esco";
import { listJobs } from "@/src/services/jobs";
import { getJobStatusCondition } from "@/src/services/jobs/filters";
import { getJobPipelineSummary } from "@/src/services/jobs/pipeline-summary";

export const dynamic = "force-dynamic";

export default async function OpdrachtenLayout({ children }: { children: React.ReactNode }) {
  const activeJobsCondition = getJobStatusCondition("open");
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const persistedEndClient = sql<string | null>`coalesce(${jobs.endClient}, ${jobs.company})`;
  const escoSkillRowsPromise = (async () => {
    try {
      return await listEscoSkillsForFilter();
    } catch (error) {
      console.error("[OpdrachtenLayout] listEscoSkillsForFilter failed:", error);
      return [];
    }
  })();

  const [{ data: sidebarJobRows, total: totalCount }, metaResult, categoryRows, escoSkillRows] =
    await Promise.all([
      listJobs({ limit: DEFAULT_OPDRACHTEN_LIMIT, status: "open" }),
      db
        .select({
          platforms: sql<string[]>`array_remove(array_agg(distinct ${jobs.platform}), null)`,
          endClients: sql<string[]>`array_remove(array_agg(distinct ${persistedEndClient}), null)`,
        })
        .from(jobs)
        .where(and(activeJobsCondition, gte(jobs.scrapedAt, thirtyDaysAgo))),
      db.execute(sql`
      select distinct jsonb_array_elements_text(coalesce(${jobs.categories}, '[]'::jsonb)) as category
      from ${jobs}
      where ${activeJobsCondition} and ${jobs.scrapedAt} >= ${thirtyDaysAgo}
      order by category asc
    `),
      escoSkillRowsPromise,
    ]);

  const { hasPipelineByJobId, pipelineCountByJobId } = await getJobPipelineSummary(
    sidebarJobRows.map((job) => job.id),
  );
  const sidebarJobs = sidebarJobRows.map((job) => ({
    id: job.id,
    title: job.title,
    company: job.endClient ?? job.company,
    location: job.location ?? job.province,
    platform: job.platform,
    workArrangement: job.workArrangement,
    contractType: job.contractType,
    applicationDeadline: job.applicationDeadline,
    hasPipeline: hasPipelineByJobId.has(job.id),
    pipelineCount: pipelineCountByJobId.get(job.id) ?? 0,
  }));

  const platforms = (metaResult[0]?.platforms ?? []).filter(Boolean).sort();
  const endClients = (metaResult[0]?.endClients ?? []).filter(Boolean).sort();
  const categories = (categoryRows.rows as Array<{ category: string | null }>)
    .map((row) => row.category)
    .filter((value): value is string => Boolean(value));
  const skillOptions = escoSkillRows.map((skill) => ({
    value: skill.uri,
    label: skill.labelNl ?? skill.labelEn,
  }));

  return (
    <OpdrachtenLayoutShell
      sidebar={
        <OpdrachtenSidebar
          jobs={sidebarJobs}
          totalCount={totalCount}
          platforms={platforms}
          endClients={endClients}
          categories={categories}
          skillOptions={skillOptions}
        />
      }
    >
      {children}
    </OpdrachtenLayoutShell>
  );
}
