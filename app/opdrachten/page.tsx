import { db } from "@/src/db";
import { jobs } from "@/src/db/schema";
import { desc, isNull, ilike, eq, and, sql } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { JobCard } from "@/components/job-card";
import { OpdrachtenFilters } from "./filters";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    q?: string;
    platform?: string;
    pagina?: string;
  }>;
}

const PER_PAGE = 20;

export default async function OpdrachtenPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = params.q ?? "";
  const platform = params.platform ?? "";
  const page = Math.max(1, parseInt(params.pagina ?? "1", 10));
  const offset = (page - 1) * PER_PAGE;

  // Build conditions
  const conditions = [isNull(jobs.deletedAt)];

  if (query) {
    conditions.push(ilike(jobs.title, `%${query}%`));
  }
  if (platform) {
    conditions.push(eq(jobs.platform, platform));
  }

  const whereClause = and(...conditions);

  // Fetch jobs + total count in parallel
  const [jobRows, countResult] = await Promise.all([
    db
      .select()
      .from(jobs)
      .where(whereClause)
      .orderBy(desc(jobs.scrapedAt))
      .limit(PER_PAGE)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobs)
      .where(whereClause),
  ]);

  const totalCount = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PER_PAGE);

  // Get distinct platforms for filter
  const platformRows = await db
    .selectDistinct({ platform: jobs.platform })
    .from(jobs)
    .where(isNull(jobs.deletedAt))
    .orderBy(jobs.platform);

  const platforms = platformRows.map((r) => r.platform);

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <PageHeader
        title="Opdrachten"
        description={`${totalCount} opdrachten gevonden`}
      />

      <OpdrachtenFilters
        query={query}
        platform={platform}
        platforms={platforms}
        page={page}
        totalPages={totalPages}
      />

      {jobRows.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">Geen opdrachten gevonden</p>
          <p className="text-sm mt-1">Pas je zoekopdracht of filters aan</p>
        </div>
      ) : (
        <div className="grid gap-4 mt-6">
          {jobRows.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
