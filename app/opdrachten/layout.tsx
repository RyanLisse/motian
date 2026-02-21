import { db } from "@/src/db";
import { jobs } from "@/src/db/schema";
import { desc, isNull, sql } from "drizzle-orm";
import { OpdrachtenSidebar } from "@/components/opdrachten-sidebar";

export const dynamic = "force-dynamic";

export default async function OpdrachtenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch sidebar jobs + total count
  const [sidebarJobs, countResult] = await Promise.all([
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
      .limit(100),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobs)
      .where(isNull(jobs.deletedAt)),
  ]);

  const totalCount = countResult[0]?.count ?? 0;

  return (
    <div className="flex h-[calc(100vh-57px)]">
      <OpdrachtenSidebar jobs={sidebarJobs} totalCount={totalCount} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
