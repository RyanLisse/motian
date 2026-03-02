import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  CheckCircle2,
  Clock,
  Link2,
  Sparkles,
  User,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { AIGrading } from "@/components/ai-grading";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { KPICard } from "@/components/shared/kpi-card";
import { Pagination } from "@/components/shared/pagination";
import { Badge } from "@/components/ui/badge";
import { db } from "@/src/db";
import { candidates, jobMatches, jobs } from "@/src/db/schema";
import type { CriterionResult } from "@/src/schemas/matching";
import { getGradedCandidates } from "@/src/services/grading";
import { CandidateLinker } from "./candidate-linker";
import { CvAnalyseTab } from "./cv-analyse-tab";
import { MatchActions } from "./match-actions";
import { MatchDetail } from "./match-detail";
import { ReportButton } from "./report-button";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    tab?: string;
    status?: string;
    pagina?: string;
    jobId?: string;
  }>;
}

const PER_PAGE = 20;

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  approved: "bg-primary/10 text-primary border-primary/20",
  rejected: "bg-red-500/10 text-red-500 border-red-500/20",
};

const statusLabels: Record<string, string> = {
  pending: "In afwachting",
  approved: "Goedgekeurd",
  rejected: "Afgewezen",
};

/** Build a query string that always preserves the jobId context. */
function buildQs(base: Record<string, string>, jobId?: string): string {
  const params = new URLSearchParams({ ...base, ...(jobId ? { jobId } : {}) });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export default async function MatchingPage({ searchParams }: Props) {
  const params = await searchParams;
  const tab = params.tab ?? "";
  const statusFilter = params.status ?? "";
  const page = Math.max(1, parseInt(params.pagina ?? "1", 10));
  const offset = (page - 1) * PER_PAGE;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const jobId = UUID_RE.test(params.jobId ?? "") ? (params.jobId ?? "") : "";
  const tabOptions = [
    { value: "", label: "AI Matching" },
    { value: "grading", label: "AI Grading" },
    { value: "cv", label: "CV Analyse" },
  ];

  // Fetch job context when jobId is provided
  let jobContext: { id: string; title: string; company: string | null } | null = null;
  if (jobId) {
    const jobRows = await db
      .select({ id: jobs.id, title: jobs.title, company: jobs.company })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);
    jobContext = jobRows[0] ?? null;
  }

  if (tab === "grading") {
    const gradedCandidates = await getGradedCandidates({
      jobId: jobId || undefined,
      limit: 50,
    });

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">Matching</h1>
            <p className="text-sm text-muted-foreground mt-1">
              AI-gestuurde matching — beoordeel kandidaat-vacature matches
            </p>
          </div>

          <FilterTabs
            options={tabOptions}
            activeValue={tab}
            buildHref={(v) => `/matching${buildQs(v ? { tab: v } : {}, jobId)}`}
            variant="subtle"
          />

          <AIGrading candidates={gradedCandidates} />
        </div>
      </div>
    );
  }

  if (tab === "cv") {
    // Fetch recent CV analyses
    const recentCvsPromise = db
      .select({
        id: candidates.id,
        name: candidates.name,
        role: candidates.role,
        resumeUrl: candidates.resumeUrl,
        resumeParsedAt: candidates.resumeParsedAt,
      })
      .from(candidates)
      .where(and(isNull(candidates.deletedAt), sql`${candidates.resumeParsedAt} IS NOT NULL`))
      .orderBy(desc(candidates.resumeParsedAt))
      .limit(10);

    const recentCvsRaw = await recentCvsPromise;
    const recentCvs = recentCvsRaw
      .filter((c) => c.resumeParsedAt !== null)
      .map((c) => ({
        id: c.id,
        name: c.name,
        role: c.role,
        resumeUrl: c.resumeUrl,
        resumeParsedAt: c.resumeParsedAt as Date,
      }));

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">Matching</h1>
            <p className="text-sm text-muted-foreground mt-1">
              AI-gestuurde matching — beoordeel kandidaat-vacature matches
            </p>
          </div>

          <FilterTabs
            options={tabOptions}
            activeValue={tab}
            buildHref={(v) => `/matching${buildQs(v ? { tab: v } : {}, jobId)}`}
            variant="subtle"
          />

          <CvAnalyseTab recentAnalyses={recentCvs} />
        </div>
      </div>
    );
  }

  // Build WHERE conditions: always filter by status, optionally by jobId
  const conditions: ReturnType<typeof eq>[] = [];
  if (statusFilter) conditions.push(eq(jobMatches.status, statusFilter));
  if (jobId) conditions.push(eq(jobMatches.jobId, jobId));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Scoped count conditions (for KPI cards, scoped to jobId if present)
  const scopeCondition = jobId ? eq(jobMatches.jobId, jobId) : undefined;

  const [matchRows, totalResult, pendingResult, approvedResult, rejectedResult] = await Promise.all(
    [
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
        .where(whereClause)
        .orderBy(desc(jobMatches.matchScore))
        .limit(PER_PAGE)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(jobMatches).where(whereClause),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(jobMatches)
        .where(
          scopeCondition
            ? and(eq(jobMatches.status, "pending"), scopeCondition)
            : eq(jobMatches.status, "pending"),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(jobMatches)
        .where(
          scopeCondition
            ? and(eq(jobMatches.status, "approved"), scopeCondition)
            : eq(jobMatches.status, "approved"),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(jobMatches)
        .where(
          scopeCondition
            ? and(eq(jobMatches.status, "rejected"), scopeCondition)
            : eq(jobMatches.status, "rejected"),
        ),
    ],
  );

  const totalCount = totalResult[0]?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PER_PAGE);
  const pendingCount = pendingResult[0]?.count ?? 0;
  const approvedCount = approvedResult[0]?.count ?? 0;
  const rejectedCount = rejectedResult[0]?.count ?? 0;
  const allCount = pendingCount + approvedCount + rejectedCount;

  // Collect ALL approved candidate IDs for this job (not just current page)
  const linkedCandidateIds = jobId
    ? await db
        .select({ candidateId: jobMatches.candidateId })
        .from(jobMatches)
        .where(and(eq(jobMatches.jobId, jobId), eq(jobMatches.status, "approved")))
        .then((rows) => rows.map((r) => r.candidateId).filter((id): id is string => Boolean(id)))
    : [];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Matching</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-gestuurde matching — beoordeel kandidaat-vacature matches
          </p>
        </div>

        {/* Job context banner */}
        {jobContext && (
          <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
            <Link2 className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                Koppelen voor vacature:{" "}
                <Link
                  href={`/opdrachten/${jobContext.id}`}
                  className="text-primary hover:underline"
                >
                  {jobContext.title}
                </Link>
              </p>
              {jobContext.company && (
                <p className="text-xs text-muted-foreground">{jobContext.company}</p>
              )}
            </div>
            <Link
              href="/matching"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              Context wissen
            </Link>
          </div>
        )}

        {/* Show invalid jobId warning */}
        {jobId && !jobContext && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3">
            <p className="text-sm text-yellow-600">
              Vacature niet gevonden. Je bekijkt alle matches.
            </p>
          </div>
        )}

        <FilterTabs
          options={tabOptions}
          activeValue={tab}
          buildHref={(v) => `/matching${buildQs(v ? { tab: v } : {}, jobId)}`}
          variant="subtle"
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KPICard icon={<BarChart3 className="h-4 w-4" />} label="Totaal" value={allCount} />
          <KPICard
            icon={<Clock className="h-4 w-4" />}
            label="In afwachting"
            value={pendingCount}
            iconClassName="text-yellow-500/60"
            valueClassName="text-yellow-500"
          />
          <KPICard
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Goedgekeurd"
            value={approvedCount}
            iconClassName="text-primary/60"
            valueClassName="text-primary"
          />
          <KPICard
            icon={<XCircle className="h-4 w-4" />}
            label="Afgewezen"
            value={rejectedCount}
            iconClassName="text-red-500/60"
            valueClassName="text-red-500"
          />
        </div>

        <FilterTabs
          options={[
            { value: "", label: "Alle" },
            { value: "pending", label: "In afwachting" },
            { value: "approved", label: "Goedgekeurd" },
            { value: "rejected", label: "Afgewezen" },
          ]}
          activeValue={statusFilter}
          buildHref={(v) => `/matching${buildQs(v ? { status: v } : {}, jobId)}`}
        />

        {/* Manual candidate linker (only when in job context) */}
        {jobContext && <CandidateLinker jobId={jobId} linkedCandidateIds={linkedCandidateIds} />}

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{totalCount} matches gevonden</p>
          {totalPages > 1 && (
            <p className="text-sm text-muted-foreground">
              Pagina {page} van {totalPages}
            </p>
          )}
        </div>

        {matchRows.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="h-8 w-8 opacity-40" />}
            title="Geen matches gevonden"
            subtitle={
              statusFilter
                ? "Probeer een ander statusfilter"
                : jobContext
                  ? "Er zijn nog geen matches voor deze vacature. Gebruik handmatig koppelen hierboven."
                  : "Er zijn nog geen AI-matches gegenereerd"
            }
          />
        ) : (
          <div className="space-y-3">
            {matchRows.map((row) => {
              const score = Math.round(row.match.matchScore);
              const confidence = row.match.confidence ? Math.round(row.match.confidence) : null;

              return (
                <div
                  key={row.match.id}
                  className="bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">
                          Kandidaat
                        </span>
                      </div>
                      {row.candidate ? (
                        <Link
                          href={`/professionals/${row.candidate.id}`}
                          className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                        >
                          {row.candidate.name}
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">Kandidaat verwijderd</span>
                      )}
                      {row.candidate?.role && (
                        <p className="text-xs text-muted-foreground">{row.candidate.role}</p>
                      )}
                    </div>

                    <ArrowRight className="h-4 w-4 text-border shrink-0" />

                    <div className="flex-1 min-w-0 text-right">
                      <div className="flex items-center justify-end gap-1.5 mb-0.5">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">
                          Vacature
                        </span>
                        <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      {row.job ? (
                        <Link
                          href={`/opdrachten/${row.job.id}`}
                          className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                        >
                          {row.job.title}
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">Vacature verwijderd</span>
                      )}
                      {row.job?.company && (
                        <p className="text-xs text-muted-foreground">{row.job.company}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Match score</span>
                        <span
                          className={
                            score >= 80
                              ? "text-primary font-medium"
                              : score >= 60
                                ? "text-yellow-500 font-medium"
                                : "text-red-500 font-medium"
                          }
                        >
                          {score}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            score >= 80
                              ? "bg-primary"
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
                        <span className="text-xs text-muted-foreground">Betrouwbaarheid</span>
                        <p className="text-sm font-medium text-muted-foreground">{confidence}%</p>
                      </div>
                    )}
                  </div>

                  {row.match.reasoning && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                      <Sparkles className="h-3 w-3 inline mr-1 text-primary/60" />
                      {row.match.reasoning}
                    </p>
                  )}

                  {row.match.assessmentModel === "marienne-v1" && row.match.criteriaBreakdown ? (
                    <div className="mt-3 pt-3 border-t border-border">
                      <MatchDetail
                        criteriaBreakdown={row.match.criteriaBreakdown as CriterionResult[]}
                        overallScore={row.match.matchScore}
                        knockoutsPassed={
                          !((row.match.riskProfile as string[] | null) ?? []).some((r) =>
                            r.toLowerCase().includes("knock"),
                          )
                        }
                        riskProfile={(row.match.riskProfile as string[] | null) ?? []}
                        enrichmentSuggestions={
                          (row.match.enrichmentSuggestions as string[] | null) ?? []
                        }
                        recommendation={(row.match.recommendation as string) ?? "conditional"}
                        recommendationReasoning={row.match.reasoning ?? ""}
                        recommendationConfidence={
                          (row.match.recommendationConfidence as number) ?? 0
                        }
                      />
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${statusColors[row.match.status] ?? "border-border text-muted-foreground"}`}
                    >
                      {statusLabels[row.match.status] ?? row.match.status}
                    </Badge>

                    <div className="flex items-center gap-2">
                      {row.match.assessmentModel === "marienne-v1" &&
                        Boolean(row.match.criteriaBreakdown) && (
                          <ReportButton matchId={row.match.id} />
                        )}
                      {row.match.status === "pending" && <MatchActions matchId={row.match.id} />}
                    </div>

                    {row.match.reviewedAt && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(row.match.reviewedAt).toLocaleDateString("nl-NL", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          buildHref={(p) =>
            `/matching${buildQs(
              {
                ...(statusFilter ? { status: statusFilter } : {}),
                pagina: String(p),
              },
              jobId,
            )}`
          }
        />

        <div className="h-8" />
      </div>
    </div>
  );
}
