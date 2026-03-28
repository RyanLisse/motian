import { Calendar, Clock, Filter, Monitor, Star } from "lucide-react";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { KPICard } from "@/components/shared/kpi-card";
import { Pagination } from "@/components/shared/pagination";
import { and, db, desc, eq, gte, isNull, sql } from "@/src/db";
import { applications, candidates, interviews, jobs } from "@/src/db/schema";
import { parsePagination } from "@/src/lib/pagination";
import { InterviewCard, statusLabels } from "./_components/interview-card";

export const revalidate = 60;

/** Search and pagination via URL (Next.js Learn: adding-search-and-pagination). */
interface Props {
  searchParams: Promise<{
    status?: string;
    pagina?: string;
    page?: string;
    limit?: string;
    perPage?: string;
  }>;
}

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 50;

const STATUSES = ["scheduled", "completed", "cancelled"];

function InterviewsSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <div className="h-7 w-32 rounded bg-muted animate-pulse" />
          <div className="h-4 w-56 rounded bg-muted animate-pulse mt-2" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton items
            <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
        <div className="h-10 w-64 rounded bg-muted animate-pulse" />
        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton items
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

async function InterviewsContent({ searchParams }: Props) {
  const params = await searchParams;
  const statusFilter = params.status ?? "";

  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    const v = Array.isArray(value) ? value[0] : value;
    if (v) urlParams.set(key, v);
  }
  const { page, limit, offset } = parsePagination(urlParams, {
    limit: DEFAULT_PER_PAGE,
    maxLimit: MAX_PER_PAGE,
  });

  // KPI counts
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);

  const [statusCounts, upcomingCount, weekCount] = await Promise.all([
    db
      .select({
        status: interviews.status,
        count: sql<number>`count(*)::int`,
      })
      .from(interviews)
      .where(isNull(interviews.deletedAt))
      .groupBy(interviews.status),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(interviews)
      .where(
        and(
          isNull(interviews.deletedAt),
          eq(interviews.status, "scheduled"),
          gte(interviews.scheduledAt, now),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(interviews)
      .where(and(isNull(interviews.deletedAt), gte(interviews.scheduledAt, weekStart))),
  ]);

  const countMap: Record<string, number> = {};
  for (const row of statusCounts) countMap[row.status] = row.count;

  // Query interviews with joins
  const conditions = [isNull(interviews.deletedAt)];
  if (statusFilter && STATUSES.includes(statusFilter)) {
    conditions.push(eq(interviews.status, statusFilter));
  }
  const where = and(...conditions);

  const [rows, countRows] = await Promise.all([
    db
      .select({
        interview: interviews,
        candidateName: candidates.name,
        jobTitle: jobs.title,
        jobCompany: jobs.company,
      })
      .from(interviews)
      .innerJoin(applications, eq(interviews.applicationId, applications.id))
      .leftJoin(candidates, eq(applications.candidateId, candidates.id))
      .leftJoin(jobs, eq(applications.jobId, jobs.id))
      .where(where)
      .orderBy(desc(interviews.scheduledAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(interviews).where(where),
  ]);

  const totalFiltered = countRows[0]?.count ?? 0;
  const totalPages = Math.ceil(totalFiltered / limit) || 1;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <PageHeader title="Interviews" description="Gesprekken plannen en bijhouden" />

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KPICard
            icon={<Calendar className="h-4 w-4" />}
            label="Aankomende"
            value={upcomingCount[0]?.count ?? 0}
            compact
          />
          <KPICard
            icon={<Monitor className="h-4 w-4" />}
            label="Afgerond"
            value={countMap.completed ?? 0}
            compact
          />
          <KPICard
            icon={<Clock className="h-4 w-4" />}
            label="Geannuleerd"
            value={countMap.cancelled ?? 0}
            compact
          />
          <KPICard
            icon={<Star className="h-4 w-4" />}
            label="Deze week"
            value={weekCount[0]?.count ?? 0}
            compact
          />
        </div>

        {/* Status filter tabs */}
        <FilterTabs
          options={[
            { value: "", label: "Alle" },
            ...STATUSES.map((s) => ({ value: s, label: statusLabels[s] })),
          ]}
          activeValue={statusFilter}
          buildHref={(v) => `/interviews${v ? `?status=${v}` : ""}`}
          variant="subtle"
          icon={<Filter className="h-4 w-4 text-muted-foreground" />}
        />

        {/* Results */}
        {rows.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-12 w-12" />}
            title="Geen interviews gevonden"
            subtitle="Plan een interview in via de pipeline"
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {totalFiltered} interview{totalFiltered !== 1 ? "s" : ""} gevonden — Pagina {page} van{" "}
              {totalPages}
            </p>
            <div className="grid gap-3">
              {rows.map((row) => (
                <InterviewCard
                  key={row.interview.id}
                  interview={row.interview}
                  candidateName={row.candidateName}
                  jobTitle={row.jobTitle}
                  jobCompany={row.jobCompany}
                />
              ))}
            </div>

            {/* Pagination */}
            <Pagination
              page={page}
              totalPages={totalPages}
              buildHref={(p) => {
                const sp = new URLSearchParams({
                  ...(statusFilter ? { status: statusFilter } : {}),
                  pagina: String(p),
                });
                if (limit !== DEFAULT_PER_PAGE) sp.set("limit", String(limit));
                return `/interviews?${sp.toString()}`;
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default function InterviewsPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<InterviewsSkeleton />}>
      <InterviewsContent searchParams={searchParams} />
    </Suspense>
  );
}
