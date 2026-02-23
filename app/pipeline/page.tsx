import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { Briefcase, CheckCircle2, Filter, Inbox, Users, XCircle } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { db } from "@/src/db";
import { applications, candidates, jobs } from "@/src/db/schema";

export const revalidate = 60;

interface Props {
  searchParams: Promise<{
    fase?: string;
    pagina?: string;
  }>;
}

const PER_PAGE = 20;

const stageColors: Record<string, string> = {
  new: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  screening: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  interview: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  offer: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  hired: "bg-[#10a37f]/10 text-[#10a37f] border-[#10a37f]/20",
  rejected: "bg-red-500/10 text-red-500 border-red-500/20",
};

const stageLabels: Record<string, string> = {
  new: "Nieuw",
  screening: "Screening",
  interview: "Interview",
  offer: "Aanbod",
  hired: "Geplaatst",
  rejected: "Afgewezen",
};

const stageIcons: Record<string, typeof Inbox> = {
  new: Inbox,
  screening: Filter,
  interview: Users,
  offer: Briefcase,
  hired: CheckCircle2,
  rejected: XCircle,
};

export default async function PipelinePage({ searchParams }: Props) {
  const params = await searchParams;
  const stageFilter = params.fase ?? "";
  const page = Math.max(1, parseInt(params.pagina ?? "1", 10));
  const offset = (page - 1) * PER_PAGE;

  // Build where clause
  const conditions = [isNull(applications.deletedAt)];
  if (stageFilter) {
    conditions.push(eq(applications.stage, stageFilter));
  }
  const whereClause = and(...conditions);

  // Fetch applications + KPIs in parallel
  const [rows, totalResult, newResult, screeningResult, interviewResult, offerResult, hiredResult] =
    await Promise.all([
      db
        .select({
          application: applications,
          jobTitle: jobs.title,
          jobCompany: jobs.company,
          candidateName: candidates.name,
          candidateEmail: candidates.email,
        })
        .from(applications)
        .leftJoin(jobs, eq(applications.jobId, jobs.id))
        .leftJoin(candidates, eq(applications.candidateId, candidates.id))
        .where(whereClause)
        .orderBy(desc(applications.createdAt))
        .limit(PER_PAGE)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(applications).where(whereClause),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(applications)
        .where(and(isNull(applications.deletedAt), eq(applications.stage, "new"))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(applications)
        .where(and(isNull(applications.deletedAt), eq(applications.stage, "screening"))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(applications)
        .where(and(isNull(applications.deletedAt), eq(applications.stage, "interview"))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(applications)
        .where(and(isNull(applications.deletedAt), eq(applications.stage, "offer"))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(applications)
        .where(and(isNull(applications.deletedAt), eq(applications.stage, "hired"))),
    ]);

  const totalCount = totalResult[0]?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PER_PAGE);
  const newCount = newResult[0]?.count ?? 0;
  const screeningCount = screeningResult[0]?.count ?? 0;
  const interviewCount = interviewResult[0]?.count ?? 0;
  const offerCount = offerResult[0]?.count ?? 0;
  const hiredCount = hiredResult[0]?.count ?? 0;
  const allCount = newCount + screeningCount + interviewCount + offerCount + hiredCount;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-[#ececec]">Pipeline</h1>
          <p className="text-sm text-[#8e8e8e] mt-1">
            Sollicitatiepipeline — volg kandidaten door elke fase
          </p>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-4">
            <div className="flex items-center gap-2 text-[#6b6b6b] mb-1">
              <Briefcase className="h-4 w-4" />
              <span className="text-xs">Totaal</span>
            </div>
            <p className="text-2xl font-bold text-[#ececec]">{allCount}</p>
          </div>
          <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-4">
            <div className="flex items-center gap-2 text-yellow-500/60 mb-1">
              <Inbox className="h-4 w-4" />
              <span className="text-xs text-[#6b6b6b]">Nieuw</span>
            </div>
            <p className="text-2xl font-bold text-yellow-500">{newCount}</p>
          </div>
          <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-4">
            <div className="flex items-center gap-2 text-blue-500/60 mb-1">
              <Filter className="h-4 w-4" />
              <span className="text-xs text-[#6b6b6b]">Screening</span>
            </div>
            <p className="text-2xl font-bold text-blue-500">{screeningCount}</p>
          </div>
          <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-4">
            <div className="flex items-center gap-2 text-purple-500/60 mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs text-[#6b6b6b]">Interview</span>
            </div>
            <p className="text-2xl font-bold text-purple-500">{interviewCount}</p>
          </div>
          <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-4">
            <div className="flex items-center gap-2 text-orange-500/60 mb-1">
              <Briefcase className="h-4 w-4" />
              <span className="text-xs text-[#6b6b6b]">Aanbod</span>
            </div>
            <p className="text-2xl font-bold text-orange-500">{offerCount}</p>
          </div>
          <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-4">
            <div className="flex items-center gap-2 text-[#10a37f]/60 mb-1">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs text-[#6b6b6b]">Geplaatst</span>
            </div>
            <p className="text-2xl font-bold text-[#10a37f]">{hiredCount}</p>
          </div>
        </div>

        {/* Stage filter tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { value: "", label: "Alle" },
            { value: "new", label: "Nieuw" },
            { value: "screening", label: "Screening" },
            { value: "interview", label: "Interview" },
            { value: "offer", label: "Aanbod" },
            { value: "hired", label: "Geplaatst" },
            { value: "rejected", label: "Afgewezen" },
          ].map((opt) => (
            <Link
              key={opt.value}
              href={`/pipeline${opt.value ? `?fase=${opt.value}` : ""}`}
              className={`h-8 px-3 flex items-center rounded-lg text-sm transition-colors ${
                stageFilter === opt.value
                  ? "bg-[#10a37f] text-white"
                  : "bg-[#1e1e1e] border border-[#2d2d2d] text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#232323]"
              }`}
            >
              {opt.label}
            </Link>
          ))}
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#8e8e8e]">{totalCount} sollicitaties gevonden</p>
          {totalPages > 1 && (
            <p className="text-sm text-[#6b6b6b]">
              Pagina {page} van {totalPages}
            </p>
          )}
        </div>

        {/* Application cards */}
        {rows.length === 0 ? (
          <div className="text-center py-16 text-[#6b6b6b]">
            <Inbox className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p className="text-lg">Geen sollicitaties gevonden</p>
            <p className="text-sm mt-1">
              {stageFilter
                ? "Probeer een ander fasefilter"
                : "Start met het matchen van kandidaten aan vacatures"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const stage = row.application.stage;
              const StageIcon = stageIcons[stage] ?? Inbox;

              return (
                <div
                  key={row.application.id}
                  className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-4 hover:border-[#10a37f]/40 hover:bg-[#232323] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: candidate + job info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="h-3.5 w-3.5 text-[#6b6b6b]" />
                        <span className="text-sm font-semibold text-[#ececec]">
                          {row.candidateName ?? "Kandidaat verwijderd"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Briefcase className="h-3.5 w-3.5 text-[#6b6b6b]" />
                        <span className="text-sm text-[#8e8e8e]">
                          {row.jobTitle ?? "Vacature verwijderd"}
                          {row.jobCompany && (
                            <span className="text-[#6b6b6b]"> bij {row.jobCompany}</span>
                          )}
                        </span>
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center gap-3 text-xs text-[#6b6b6b]">
                        {row.application.source && (
                          <span className="capitalize">{row.application.source}</span>
                        )}
                        {row.application.createdAt && (
                          <span>
                            {new Date(row.application.createdAt).toLocaleDateString("nl-NL", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: stage badge */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant="outline"
                        className={`text-[10px] flex items-center gap-1 ${stageColors[stage] ?? "border-[#2d2d2d] text-[#6b6b6b]"}`}
                      >
                        <StageIcon className="h-3 w-3" />
                        {stageLabels[stage] ?? stage}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            {page > 1 && (
              <Link
                href={`/pipeline?${new URLSearchParams({
                  ...(stageFilter ? { fase: stageFilter } : {}),
                  pagina: String(page - 1),
                }).toString()}`}
                className="h-9 px-4 flex items-center bg-[#1e1e1e] border border-[#2d2d2d] rounded-lg text-sm text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#232323] transition-colors"
              >
                Vorige
              </Link>
            )}
            <span className="text-sm text-[#6b6b6b] px-2">
              {page} / {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={`/pipeline?${new URLSearchParams({
                  ...(stageFilter ? { fase: stageFilter } : {}),
                  pagina: String(page + 1),
                }).toString()}`}
                className="h-9 px-4 flex items-center bg-[#1e1e1e] border border-[#2d2d2d] rounded-lg text-sm text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#232323] transition-colors"
              >
                Volgende
              </Link>
            )}
          </div>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
}
