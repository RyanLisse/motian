import { desc, isNull, sql } from "drizzle-orm";
import { OpdrachtenLayoutShell } from "@/components/opdrachten-layout-shell";
import { OpdrachtenSidebar } from "@/components/opdrachten-sidebar";
import { db } from "@/src/db";
import { applications, jobs } from "@/src/db/schema";

export const dynamic = "force-dynamic";

export default async function OpdrachtenLayout({ children }: { children: React.ReactNode }) {
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
      .where(isNull(jobs.deletedAt))
      .orderBy(desc(jobs.scrapedAt))
      .limit(10),
    // Count + distinct platforms in a single query
    db
      .select({
        count: sql<number>`count(*)::int`,
        platforms: sql<string[]>`array_agg(distinct ${jobs.platform} order by ${jobs.platform})`,
      })
      .from(jobs)
      .where(isNull(jobs.deletedAt)),
  ]);

  const totalCount = metaResult[0]?.count ?? 0;
  const platforms = (metaResult[0]?.platforms ?? []).filter(Boolean);

  return (
    <OpdrachtenLayoutShell
      sidebar={
        <OpdrachtenSidebar jobs={sidebarJobs} totalCount={totalCount} platforms={platforms} />
      }
    >
      {children}
    </OpdrachtenLayoutShell>
  );
}
