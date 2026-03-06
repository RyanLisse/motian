import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { OpdrachtenLayoutShell } from "@/components/opdrachten-layout-shell";
import { OpdrachtenSidebar } from "@/components/opdrachten-sidebar";
import { db } from "@/src/db";
import { applications, jobs } from "@/src/db/schema";
import { DEFAULT_OPDRACHTEN_LIMIT } from "@/src/lib/opdrachten-filters";

export const dynamic = "force-dynamic";

export default async function OpdrachtenLayout({ children }: { children: React.ReactNode }) {
  const activeJobsCondition = and(isNull(jobs.deletedAt), eq(jobs.status, "open"));
  const persistedEndClient = sql<string | null>`coalesce(${jobs.endClient}, ${jobs.company})`;

  const [sidebarJobs, countResult, metaResult] = await Promise.all([
    db
      .select({
        id: jobs.id,
        title: jobs.title,
        company: persistedEndClient,
        location: jobs.location,
        platform: jobs.platform,
        workArrangement: jobs.workArrangement,
        contractType: jobs.contractType,
        pipelineCount: sql<number>`(
          select count(*)::int from ${applications}
          where ${applications.jobId} = ${jobs.id}
            and ${applications.deletedAt} is null
            and ${applications.stage} != 'rejected'
        )`,
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
      .where(isNull(jobs.deletedAt)),
  ]);

  const totalCount = countResult[0]?.count ?? 0;
  const platforms = (metaResult[0]?.platforms ?? []).filter(Boolean).sort();
  const endClients = (metaResult[0]?.endClients ?? []).filter(Boolean).sort();

  return (
    <OpdrachtenLayoutShell
      sidebar={
        <OpdrachtenSidebar
          jobs={sidebarJobs}
          totalCount={totalCount}
          platforms={platforms}
          endClients={endClients}
        />
      }
    >
      {children}
    </OpdrachtenLayoutShell>
  );
}
