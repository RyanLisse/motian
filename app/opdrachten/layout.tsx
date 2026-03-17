import { OpdrachtenLayoutShell } from "@/components/opdrachten-layout-shell";
import { OpdrachtenSidebar } from "@/components/opdrachten-sidebar";
import { db, sql } from "@/src/db";
import { jobs } from "@/src/db/schema";
import { DEFAULT_OPDRACHTEN_LIMIT } from "@/src/lib/opdrachten-filters";
import { listEscoSkillsForFilter } from "@/src/services/esco";
import { listJobs } from "@/src/services/jobs";
import { getJobStatusCondition } from "@/src/services/jobs/filters";
import { getJobPipelineSummary } from "@/src/services/jobs/pipeline-summary";

export const dynamic = "force-dynamic";

export default async function OpdrachtenLayout({ children }: { children: React.ReactNode }) {
  const activeJobsCondition = getJobStatusCondition("open");
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
          platforms: sql<string | null>`json_group_array(distinct ${jobs.platform})`,
          endClients: sql<string | null>`json_group_array(distinct ${persistedEndClient})`,
        })
        .from(jobs)
        .where(activeJobsCondition),
      db.all<{ category: string }>(sql`
      select distinct je.value as category
      from ${jobs}, json_each(coalesce(${jobs.categories}, '[]')) as je
      where ${activeJobsCondition} and je.value is not null
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

  const platformsRaw = metaResult[0]?.platforms as string | null;
  const endClientsRaw = metaResult[0]?.endClients as string | null;
  const platforms = (platformsRaw ? JSON.parse(platformsRaw) : []) as string[];
  const endClients = (endClientsRaw ? JSON.parse(endClientsRaw) : []) as string[];
  const categories = categoryRows
    .map((row) => row.category?.trim())
    .filter((value): value is string => Boolean(value && value.length > 0));
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
