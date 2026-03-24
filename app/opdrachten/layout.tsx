import { OpdrachtenLayoutShell } from "@/components/opdrachten-layout-shell";
import { OpdrachtenSidebar } from "@/components/opdrachten-sidebar";
import { db, sql } from "@/src/db";
import { jobs } from "@/src/db/schema";
import { DEFAULT_OPDRACHTEN_LIMIT } from "@/src/lib/opdrachten-filters";
import { getEscoCatalogStatus, listEscoSkillsForFilter } from "@/src/services/esco";
import { listJobs } from "@/src/services/jobs";
import { getJobStatusCondition } from "@/src/services/jobs/filters";
import { getJobPipelineSummary } from "@/src/services/jobs/pipeline-summary";

export const dynamic = "force-dynamic";

export default async function OpdrachtenLayout({ children }: { children: React.ReactNode }) {
  const activeJobsCondition = getJobStatusCondition("open");
  const persistedEndClient = sql<string | null>`coalesce(${jobs.endClient}, ${jobs.company})`;
  const escoCatalogStatusPromise = (async () => {
    try {
      return await getEscoCatalogStatus();
    } catch (error) {
      console.error("[OpdrachtenLayout] getEscoCatalogStatus failed:", error);
      return {
        available: false,
        issue: "missing_catalog" as const,
        skillCount: 0,
        aliasCount: 0,
        mappingCount: 0,
        jobSkillCount: 0,
        candidateSkillCount: 0,
        checkedAt: new Date().toISOString(),
      };
    }
  })();
  const escoSkillRowsPromise = (async () => {
    try {
      return await listEscoSkillsForFilter();
    } catch (error) {
      console.error("[OpdrachtenLayout] listEscoSkillsForFilter failed:", error);
      return [];
    }
  })();

  const [
    { data: sidebarJobRows, total: totalCount },
    metaResult,
    categoryResult,
    escoCatalogStatus,
    escoSkillRows,
  ] = await Promise.all([
    listJobs({ limit: DEFAULT_OPDRACHTEN_LIMIT, status: "open" }),
    db
      .select({
        platforms: sql<string | null>`json_agg(distinct ${jobs.platform})`,
        endClients: sql<string | null>`json_agg(distinct ${persistedEndClient})`,
      })
      .from(jobs)
      .where(activeJobsCondition),
    db.execute(sql`
      SELECT DISTINCT je.value AS category
      FROM ${jobs}, LATERAL jsonb_array_elements_text(coalesce(${jobs.categories}::jsonb, '[]'::jsonb)) AS je(value)
      WHERE ${activeJobsCondition} AND je.value IS NOT NULL
      ORDER BY category ASC
    `),
    escoCatalogStatusPromise,
    escoSkillRowsPromise,
  ]);

  const categoryRows = (categoryResult.rows ?? []) as { category: string }[];

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

  const platformsRaw = metaResult[0]?.platforms;
  const endClientsRaw = metaResult[0]?.endClients;
  const platforms = (
    Array.isArray(platformsRaw)
      ? platformsRaw
      : platformsRaw
        ? JSON.parse(platformsRaw as string)
        : []
  ).filter(Boolean) as string[];
  const endClients = (
    Array.isArray(endClientsRaw)
      ? endClientsRaw
      : endClientsRaw
        ? JSON.parse(endClientsRaw as string)
        : []
  ).filter(Boolean) as string[];
  const categories = categoryRows
    .map((row) => row.category?.trim())
    .filter((value): value is string => Boolean(value && value.length > 0));
  const skillOptions = escoSkillRows.map((skill) => ({
    value: skill.uri,
    label: skill.labelNl ?? skill.labelEn,
  }));
  const skillEmptyText =
    escoCatalogStatus.issue === "missing_catalog" || escoCatalogStatus.issue === "missing_skills"
      ? "ESCO-catalogus ontbreekt. Importeer eerst de dataset."
      : escoCatalogStatus.issue === "missing_aliases"
        ? "ESCO-aliases ontbreken. Mapping is tijdelijk beperkt."
        : "Geen vaardigheden gevonden.";

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
          skillEmptyText={skillEmptyText}
        />
      }
    >
      {children}
    </OpdrachtenLayoutShell>
  );
}
