import { desc, isNull, sql } from "drizzle-orm";
import { OpdrachtenLayoutShell } from "@/components/opdrachten-layout-shell";
import { OpdrachtenSidebar } from "@/components/opdrachten-sidebar";
import { db } from "@/src/db";
import { jobs } from "@/src/db/schema";

export const revalidate = 60;

export default async function OpdrachtenLayout({ children }: { children: React.ReactNode }) {
  // Fetch sidebar jobs, total count, and distinct platforms in parallel
  const [sidebarJobs, countResult, platformRows] = await Promise.all([
    db
      .select({
        id: jobs.id,
        title: jobs.title,
        company: jobs.company,
        location: jobs.location,
        platform: jobs.platform,
        workArrangement: jobs.workArrangement,
        contractType: jobs.contractType,
      })
      .from(jobs)
      .where(isNull(jobs.deletedAt))
      .orderBy(desc(jobs.scrapedAt))
      .limit(10),
    db.select({ count: sql<number>`count(*)::int` }).from(jobs).where(isNull(jobs.deletedAt)),
    db
      .selectDistinct({ platform: jobs.platform })
      .from(jobs)
      .where(isNull(jobs.deletedAt))
      .orderBy(jobs.platform),
  ]);

  const totalCount = countResult[0]?.count ?? 0;
  const platforms = platformRows.map((r) => r.platform);

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
