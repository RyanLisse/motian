import { and, desc, eq, gte, sql } from "drizzle-orm";
import { Calendar, Clock, Code2, Filter, MapPin, Monitor, Phone, Star, Video } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { db } from "@/src/db";
import { applications, candidates, interviews, jobs } from "@/src/db/schema";

export const revalidate = 60;

interface Props {
  searchParams: Promise<{
    status?: string;
    pagina?: string;
  }>;
}

const PER_PAGE = 20;

const statusColors: Record<string, string> = {
  scheduled: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  completed: "bg-[#10a37f]/10 text-[#10a37f] border-[#10a37f]/20",
  cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
};

const statusLabels: Record<string, string> = {
  scheduled: "Gepland",
  completed: "Afgerond",
  cancelled: "Geannuleerd",
};

const typeIcons: Record<string, typeof Phone> = {
  phone: Phone,
  video: Video,
  onsite: MapPin,
  technical: Code2,
};

const typeColors: Record<string, string> = {
  phone: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  video: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  onsite: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  technical: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
};

const STATUSES = ["scheduled", "completed", "cancelled"];

export default async function InterviewsPage({ searchParams }: Props) {
  const params = await searchParams;
  const statusFilter = params.status ?? "";
  const page = Math.max(1, parseInt(params.pagina ?? "1", 10));
  const offset = (page - 1) * PER_PAGE;

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
      .groupBy(interviews.status),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(interviews)
      .where(and(eq(interviews.status, "scheduled"), gte(interviews.scheduledAt, now))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(interviews)
      .where(gte(interviews.scheduledAt, weekStart)),
  ]);

  const countMap: Record<string, number> = {};
  for (const row of statusCounts) countMap[row.status] = row.count;

  // Query interviews with joins
  const conditions = [];
  if (statusFilter && STATUSES.includes(statusFilter)) {
    conditions.push(eq(interviews.status, statusFilter));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

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
      .limit(PER_PAGE)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(interviews).where(where),
  ]);

  const totalFiltered = countRows[0]?.count ?? 0;
  const totalPages = Math.ceil(totalFiltered / PER_PAGE);

  return (
    <main className="flex-1 overflow-y-auto bg-[#0d0d0d]">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-[#ececec]">Interviews</h1>
          <p className="text-sm text-[#8e8e8e] mt-1">Gesprekken plannen en bijhouden</p>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Aankomende", value: upcomingCount[0]?.count ?? 0, icon: Calendar },
            { label: "Afgerond", value: countMap.completed ?? 0, icon: Monitor },
            { label: "Geannuleerd", value: countMap.cancelled ?? 0, icon: Clock },
            { label: "Deze week", value: weekCount[0]?.count ?? 0, icon: Star },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon className="h-4 w-4 text-[#6b6b6b]" />
                <span className="text-xs text-[#8e8e8e]">{kpi.label}</span>
              </div>
              <p className="text-lg font-bold text-[#ececec]">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-[#6b6b6b]" />
          <Link
            href="/interviews"
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              !statusFilter
                ? "bg-[#10a37f]/10 text-[#10a37f] font-medium"
                : "text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#2a2a2a]"
            }`}
          >
            Alle
          </Link>
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={`/interviews?status=${s}`}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                statusFilter === s
                  ? "bg-[#10a37f]/10 text-[#10a37f] font-medium"
                  : "text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#2a2a2a]"
              }`}
            >
              {statusLabels[s]}
            </Link>
          ))}
        </div>

        {/* Results */}
        {rows.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="h-12 w-12 text-[#2d2d2d] mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-[#ececec] mb-2">Geen interviews gevonden</h2>
            <p className="text-sm text-[#8e8e8e]">Plan een interview in via de pipeline</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-[#8e8e8e]">
              {totalFiltered} interview{totalFiltered !== 1 ? "s" : ""} gevonden — Pagina {page} van{" "}
              {totalPages}
            </p>
            <div className="grid gap-3">
              {rows.map((row) => {
                const TypeIcon = typeIcons[row.interview.type] ?? Monitor;
                return (
                  <div
                    key={row.interview.id}
                    className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-lg p-4 hover:border-[#10a37f]/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-[#ececec] truncate">
                            {row.candidateName ?? "Onbekend"}
                          </span>
                          <span className="text-xs text-[#6b6b6b]">→</span>
                          <span className="text-sm text-[#8e8e8e] truncate">
                            {row.jobTitle ?? "Onbekend"}
                          </span>
                        </div>
                        {row.jobCompany && (
                          <p className="text-xs text-[#6b6b6b]">{row.jobCompany}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant="outline"
                          className={`text-xs ${statusColors[row.interview.status] ?? ""}`}
                        >
                          {statusLabels[row.interview.status] ?? row.interview.status}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs ${typeColors[row.interview.type] ?? ""}`}
                        >
                          <TypeIcon className="h-3 w-3 mr-1" />
                          {row.interview.type}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-[#6b6b6b]">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(row.interview.scheduledAt).toLocaleDateString("nl-NL", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}{" "}
                        {new Date(row.interview.scheduledAt).toLocaleTimeString("nl-NL", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {row.interview.duration ?? 60} min
                      </span>
                      <span>{row.interview.interviewer}</span>
                      {row.interview.rating && (
                        <span className="flex items-center gap-0.5">
                          <Star className="h-3 w-3 text-yellow-500" />
                          {row.interview.rating}/5
                        </span>
                      )}
                    </div>
                    {row.interview.feedback && (
                      <p className="mt-2 text-xs text-[#8e8e8e] line-clamp-2">
                        {row.interview.feedback}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                {page > 1 && (
                  <Link
                    href={`/interviews?${statusFilter ? `status=${statusFilter}&` : ""}pagina=${page - 1}`}
                    className="px-3 py-1.5 rounded-md text-sm text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#2a2a2a] transition-colors"
                  >
                    ← Vorige
                  </Link>
                )}
                <span className="text-sm text-[#6b6b6b]">
                  {page} / {totalPages}
                </span>
                {page < totalPages && (
                  <Link
                    href={`/interviews?${statusFilter ? `status=${statusFilter}&` : ""}pagina=${page + 1}`}
                    className="px-3 py-1.5 rounded-md text-sm text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#2a2a2a] transition-colors"
                  >
                    Volgende →
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
