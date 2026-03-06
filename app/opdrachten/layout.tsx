import { and, desc, gte, isNull, or, sql } from "drizzle-orm";
import { OpdrachtenLayoutShell } from "@/components/opdrachten-layout-shell";
import { OpdrachtenSidebar } from "@/components/opdrachten-sidebar";
import { db } from "@/src/db";
import { applications, jobs } from "@/src/db/schema";

export const dynamic = "force-dynamic";

export default async function OpdrachtenLayout({ children }: { children: React.ReactNode }) {
  const now = new Date();
  const openJobsCondition = or(
    gte(jobs.applicationDeadline, now),
    and(isNull(jobs.applicationDeadline), isNull(jobs.endDate)),
    and(isNull(jobs.applicationDeadline), gte(jobs.endDate, now)),
  );

  // Fetch sidebar jobs + consolidated meta (count + platforms) to reduce DB connections
  const [sidebarJobs, metaResult] = await Promise.all([
    db
      .select({
        id: jobs.id,
        title: jobs.title,
        company: jobs.company,
        location: jobs.location,
        platform: jobs.platform,
        workArrangement: jobs.workArrangement,
        contractType: jobs.contractType,
        // Active pipeline count: excludes rejected (consistent with detail/overzicht pages)
        pipelineCount: sql<number>`(
          select count(*)::int from ${applications}
          where ${applications.jobId} = ${jobs.id}
            and ${applications.deletedAt} is null
            and ${applications.stage} != 'rejected'
        )`,
      })
      .from(jobs)
      .where(and(isNull(jobs.deletedAt), openJobsCondition))
      .orderBy(desc(jobs.scrapedAt))
      .limit(50),
    // Count + distinct platforms in a single query
    db
      .select({
        count: sql<number>`count(*) filter (where ${openJobsCondition})::int`,
        platforms: sql<string[]>`array_agg(distinct ${jobs.platform} order by ${jobs.platform})`,
        companies: sql<
          string[]
        >`array_remove(array_agg(distinct ${jobs.company} order by ${jobs.company}), null)`,
      })
      .from(jobs)
      .where(isNull(jobs.deletedAt)),
  ]);

  const totalCount = metaResult[0]?.count ?? 0;
  const platforms = (metaResult[0]?.platforms ?? []).filter(Boolean);
  const companies = (metaResult[0]?.companies ?? []).filter(Boolean);

  return (
    <OpdrachtenLayoutShell
      sidebar={
        <OpdrachtenSidebar
          jobs={sidebarJobs}
          totalCount={totalCount}
          platforms={platforms}
          companies={companies}
        />
      }
    >
      {children}
    </OpdrachtenLayoutShell>
  );
}
