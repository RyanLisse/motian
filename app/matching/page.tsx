import { db } from "@/src/db";
import { jobMatches, jobs, candidates } from "@/src/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import {
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  BarChart3,
  ArrowRight,
  User,
  Briefcase,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MatchActions } from "./match-actions";

export const revalidate = 60;

interface Props {
  searchParams: Promise<{
    status?: string;
    pagina?: string;
  }>;
}

const PER_PAGE = 20;

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  approved: "bg-[#10a37f]/10 text-[#10a37f] border-[#10a37f]/20",
  rejected: "bg-red-500/10 text-red-500 border-red-500/20",
};

const statusLabels: Record<string, string> = {
  pending: "In afwachting",
  approved: "Goedgekeurd",
  rejected: "Afgewezen",
};

export default async function MatchingPage({ searchParams }: Props) {
  const params = await searchParams;
  const statusFilter = params.status ?? "";
  const page = Math.max(1, parseInt(params.pagina ?? "1", 10));
  const offset = (page - 1) * PER_PAGE;

  // Build where clause for status filter
  const statusCondition = statusFilter
    ? eq(jobMatches.status, statusFilter)
    : undefined;

  // Fetch matches + KPIs in parallel
  const [matchRows, totalResult, pendingResult, approvedResult, rejectedResult] =
    await Promise.all([
      db
        .select({
          match: jobMatches,
          job: { id: jobs.id, title: jobs.title, company: jobs.company },
          candidate: {
            id: candidates.id,
            name: candidates.name,
            role: candidates.role,
          },
        })
        .from(jobMatches)
        .leftJoin(jobs, eq(jobMatches.jobId, jobs.id))
        .leftJoin(candidates, eq(jobMatches.candidateId, candidates.id))
        .where(statusCondition)
        .orderBy(desc(jobMatches.matchScore))
        .limit(PER_PAGE)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(jobMatches)
        .where(statusCondition),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(jobMatches)
        .where(eq(jobMatches.status, "pending")),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(jobMatches)
        .where(eq(jobMatches.status, "approved")),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(jobMatches)
        .where(eq(jobMatches.status, "rejected")),
    ]);

  const totalCount = totalResult[0]?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PER_PAGE);
  const pendingCount = pendingResult[0]?.count ?? 0;
  const approvedCount = approvedResult[0]?.count ?? 0;
  const rejectedCount = rejectedResult[0]?.count ?? 0;
  const allCount = pendingCount + approvedCount + rejectedCount;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-[#ececec]">Matching</h1>
          <p className="text-sm text-[#8e8e8e] mt-1">
            AI-gestuurde matching — beoordeel kandidaat-vacature matches
          </p>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-4">
            <div className="flex items-center gap-2 text-[#6b6b6b] mb-1">
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs">Totaal</span>
            </div>
            <p className="text-2xl font-bold text-[#ececec]">{allCount}</p>
          </div>
          <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-4">
            <div className="flex items-center gap-2 text-yellow-500/60 mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs text-[#6b6b6b]">In afwachting</span>
            </div>
            <p className="text-2xl font-bold text-yellow-500">{pendingCount}</p>
          </div>
          <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-4">
            <div className="flex items-center gap-2 text-[#10a37f]/60 mb-1">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs text-[#6b6b6b]">Goedgekeurd</span>
            </div>
            <p className="text-2xl font-bold text-[#10a37f]">
              {approvedCount}
            </p>
          </div>
          <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-4">
            <div className="flex items-center gap-2 text-red-500/60 mb-1">
              <XCircle className="h-4 w-4" />
              <span className="text-xs text-[#6b6b6b]">Afgewezen</span>
            </div>
            <p className="text-2xl font-bold text-red-500">{rejectedCount}</p>
          </div>
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2">
          {[
            { value: "", label: "Alle" },
            { value: "pending", label: "In afwachting" },
            { value: "approved", label: "Goedgekeurd" },
            { value: "rejected", label: "Afgewezen" },
          ].map((opt) => (
            <Link
              key={opt.value}
              href={`/matching${opt.value ? `?status=${opt.value}` : ""}`}
              className={`h-8 px-3 flex items-center rounded-lg text-sm transition-colors ${
                statusFilter === opt.value
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
          <p className="text-sm text-[#8e8e8e]">
            {totalCount} matches gevonden
          </p>
          {totalPages > 1 && (
            <p className="text-sm text-[#6b6b6b]">
              Pagina {page} van {totalPages}
            </p>
          )}
        </div>

        {/* Match cards */}
        {matchRows.length === 0 ? (
          <div className="text-center py-16 text-[#6b6b6b]">
            <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p className="text-lg">Geen matches gevonden</p>
            <p className="text-sm mt-1">
              {statusFilter
                ? "Probeer een ander statusfilter"
                : "Er zijn nog geen AI-matches gegenereerd"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {matchRows.map((row) => {
              const score = Math.round(row.match.matchScore);
              const confidence = row.match.confidence
                ? Math.round(row.match.confidence)
                : null;

              return (
                <div
                  key={row.match.id}
                  className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-4 hover:border-[#10a37f]/40 hover:bg-[#232323] transition-colors"
                >
                  {/* Top: candidate <-> job */}
                  <div className="flex items-center gap-3 mb-3">
                    {/* Candidate side */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <User className="h-3.5 w-3.5 text-[#6b6b6b]" />
                        <span className="text-xs text-[#6b6b6b] uppercase tracking-wider">
                          Kandidaat
                        </span>
                      </div>
                      {row.candidate ? (
                        <Link
                          href={`/professionals/${row.candidate.id}`}
                          className="text-sm font-semibold text-[#ececec] hover:text-[#10a37f] transition-colors"
                        >
                          {row.candidate.name}
                        </Link>
                      ) : (
                        <span className="text-sm text-[#6b6b6b]">
                          Kandidaat verwijderd
                        </span>
                      )}
                      {row.candidate?.role && (
                        <p className="text-xs text-[#8e8e8e]">
                          {row.candidate.role}
                        </p>
                      )}
                    </div>

                    {/* Arrow */}
                    <ArrowRight className="h-4 w-4 text-[#2d2d2d] shrink-0" />

                    {/* Job side */}
                    <div className="flex-1 min-w-0 text-right">
                      <div className="flex items-center justify-end gap-1.5 mb-0.5">
                        <span className="text-xs text-[#6b6b6b] uppercase tracking-wider">
                          Vacature
                        </span>
                        <Briefcase className="h-3.5 w-3.5 text-[#6b6b6b]" />
                      </div>
                      {row.job ? (
                        <Link
                          href={`/opdrachten/${row.job.id}`}
                          className="text-sm font-semibold text-[#ececec] hover:text-[#10a37f] transition-colors"
                        >
                          {row.job.title}
                        </Link>
                      ) : (
                        <span className="text-sm text-[#6b6b6b]">
                          Opdracht verwijderd
                        </span>
                      )}
                      {row.job?.company && (
                        <p className="text-xs text-[#8e8e8e]">
                          {row.job.company}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Score bar + confidence */}
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-[#6b6b6b]">Match score</span>
                        <span
                          className={
                            score >= 80
                              ? "text-[#10a37f] font-medium"
                              : score >= 60
                                ? "text-yellow-500 font-medium"
                                : "text-red-500 font-medium"
                          }
                        >
                          {score}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-[#2d2d2d] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            score >= 80
                              ? "bg-[#10a37f]"
                              : score >= 60
                                ? "bg-yellow-500"
                                : "bg-red-500"
                          }`}
                          style={{ width: `${Math.min(100, score)}%` }}
                        />
                      </div>
                    </div>
                    {confidence !== null && (
                      <div className="text-right shrink-0">
                        <span className="text-xs text-[#6b6b6b]">
                          Betrouwbaarheid
                        </span>
                        <p className="text-sm font-medium text-[#8e8e8e]">
                          {confidence}%
                        </p>
                      </div>
                    )}
                  </div>

                  {/* AI reasoning */}
                  {row.match.reasoning && (
                    <p className="text-xs text-[#6b6b6b] line-clamp-2 mb-3">
                      <Sparkles className="h-3 w-3 inline mr-1 text-[#10a37f]/60" />
                      {row.match.reasoning}
                    </p>
                  )}

                  {/* Bottom: status + action placeholders */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#2d2d2d]">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${statusColors[row.match.status] ?? "border-[#2d2d2d] text-[#6b6b6b]"}`}
                    >
                      {statusLabels[row.match.status] ?? row.match.status}
                    </Badge>

                    {row.match.status === "pending" && (
                      <MatchActions matchId={row.match.id} />
                    )}

                    {row.match.reviewedAt && (
                      <span className="text-xs text-[#6b6b6b]">
                        {new Date(row.match.reviewedAt).toLocaleDateString(
                          "nl-NL",
                          { day: "numeric", month: "short" }
                        )}
                      </span>
                    )}
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
                href={`/matching?${new URLSearchParams({
                  ...(statusFilter ? { status: statusFilter } : {}),
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
                href={`/matching?${new URLSearchParams({
                  ...(statusFilter ? { status: statusFilter } : {}),
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
