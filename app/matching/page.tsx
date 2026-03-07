import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Inbox,
  Link2,
  Sparkles,
  User,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AddCandidateWizard } from "@/components/add-candidate-wizard";
import { AIGrading } from "@/components/ai-grading";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { KPICard } from "@/components/shared/kpi-card";
import { Pagination } from "@/components/shared/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/src/db";
import { applications, candidates, jobMatches, jobs } from "@/src/db/schema";
import { parsePagination } from "@/src/lib/pagination";
import type { CriterionResult } from "@/src/schemas/matching";
import { getGradedCandidates } from "@/src/services/grading";
import { CandidateLinker } from "./candidate-linker";
import { CvAnalyseTab } from "./cv-analyse-tab";
import { MatchActions } from "./match-actions";
import { MatchDetail } from "./match-detail";
import { ReportButton } from "./report-button";

export const dynamic = "force-dynamic";

/** Search and pagination via URL (Next.js Learn: adding-search-and-pagination). */
interface Props {
  searchParams: Promise<{
    tab?: string;
    status?: string;
    pagina?: string;
    page?: string;
    limit?: string;
    perPage?: string;
    jobId?: string;
  }>;
}

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 50;

const reviewStatusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  approved: "bg-primary/10 text-primary border-primary/20",
  rejected: "bg-red-500/10 text-red-500 border-red-500/20",
};

const reviewStatusLabels: Record<string, string> = {
  pending: "Aanbevolen",
  approved: "In pipeline",
  rejected: "Afgewezen",
};

const inboxStatusLabels = {
  open: "Open",
  in_review: "In behandeling",
  linked: "Gekoppeld",
  no_match: "Geen match",
} as const;

const inboxStatusColors: Record<keyof typeof inboxStatusLabels, string> = {
  open: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  in_review: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  linked: "bg-primary/10 text-primary border-primary/20",
  no_match: "bg-muted text-muted-foreground border-border",
};

const sourceLabels: Record<string, string> = {
  manual: "Handmatig",
  cv: "CV",
  hybrid: "Hybride",
};

const stageLabels: Record<string, string> = {
  new: "Nieuw",
  screening: "Screening",
  interview: "Interview",
  offer: "Aanbod",
  hired: "Geplaatst",
};

const matchingStatusOptions = ["open", "in_review", "linked", "no_match"] as const;

function isMatchingStatus(value: string): value is (typeof matchingStatusOptions)[number] {
  return matchingStatusOptions.some((option) => option === value);
}

/** Build a query string that always preserves the jobId context. */
function buildQs(base: Record<string, string>, jobId?: string): string {
  const params = new URLSearchParams({ ...base, ...(jobId ? { jobId } : {}) });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function formatDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  return new Date(date).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  });
}

function recommendationLabel(recommendation: string | null): string | null {
  switch (recommendation) {
    case "go":
      return "Aanbevolen";
    case "conditional":
      return "Voorwaardelijk";
    case "no-go":
      return "Geen fit";
    default:
      return null;
  }
}

function MatchingShell({
  tab,
  jobId,
  jobContext,
  children,
}: {
  tab: string;
  jobId: string;
  jobContext: { id: string; title: string; company: string | null } | null;
  children: ReactNode;
}) {
  const tabOptions = [
    { value: "", label: "AI Matching" },
    { value: "grading", label: "AI Grading" },
    { value: "cv", label: "CV Analyse" },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Matching</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Kandidaatintake, matching inbox en AI-aanbevelingen voor recruiters
            </p>
          </div>
          <AddCandidateWizard />
        </div>

        {jobContext && (
          <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
            <Link2 className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                Aanbevelingen voor vacature:{" "}
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

        {jobId && !jobContext && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3">
            <p className="text-sm text-yellow-600">
              Vacature niet gevonden. Je bekijkt alle kandidaten in de inbox.
            </p>
          </div>
        )}

        <FilterTabs
          options={tabOptions}
          activeValue={tab}
          buildHref={(value) => `/matching${buildQs(value ? { tab: value } : {}, jobId)}`}
          variant="subtle"
        />

        {children}
      </div>
    </div>
  );
}

export default async function MatchingPage({ searchParams }: Props) {
  const params = await searchParams;
  const tab = params.tab ?? "";
  const statusFilter = isMatchingStatus(params.status ?? "") ? (params.status ?? "") : "";
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const jobId = UUID_RE.test(params.jobId ?? "") ? (params.jobId ?? "") : "";

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
      <MatchingShell tab={tab} jobId={jobId} jobContext={jobContext}>
        <AIGrading candidates={gradedCandidates} />
      </MatchingShell>
    );
  }

  if (tab === "cv") {
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
      <MatchingShell tab={tab} jobId={jobId} jobContext={jobContext}>
        <CvAnalyseTab recentAnalyses={recentCvs} />
      </MatchingShell>
    );
  }

  let scopedCandidateIds: string[] | null = null;
  let linkedCandidateIds: string[] = [];

  if (jobId) {
    const [jobMatchRows, applicationRows] = await Promise.all([
      db
        .select({ candidateId: jobMatches.candidateId, status: jobMatches.status })
        .from(jobMatches)
        .where(eq(jobMatches.jobId, jobId)),
      db
        .select({ candidateId: applications.candidateId })
        .from(applications)
        .where(and(eq(applications.jobId, jobId), isNull(applications.deletedAt))),
    ]);

    const candidateIdSet = new Set<string>();
    const linkedIdSet = new Set<string>();

    for (const row of jobMatchRows) {
      if (!row.candidateId) continue;
      candidateIdSet.add(row.candidateId);
      if (row.status === "approved") linkedIdSet.add(row.candidateId);
    }

    for (const row of applicationRows) {
      if (!row.candidateId) continue;
      candidateIdSet.add(row.candidateId);
      linkedIdSet.add(row.candidateId);
    }

    scopedCandidateIds = Array.from(candidateIdSet);
    linkedCandidateIds = Array.from(linkedIdSet);
  }

  const candidateScopeCondition =
    scopedCandidateIds && scopedCandidateIds.length > 0
      ? inArray(candidates.id, scopedCandidateIds)
      : undefined;

  const candidateListWhere = statusFilter
    ? candidateScopeCondition
      ? and(
          isNull(candidates.deletedAt),
          candidateScopeCondition,
          eq(candidates.matchingStatus, statusFilter),
        )
      : and(isNull(candidates.deletedAt), eq(candidates.matchingStatus, statusFilter))
    : candidateScopeCondition
      ? and(isNull(candidates.deletedAt), candidateScopeCondition)
      : isNull(candidates.deletedAt);

  const candidateCountsWhere = candidateScopeCondition
    ? and(isNull(candidates.deletedAt), candidateScopeCondition)
    : isNull(candidates.deletedAt);

  const noScopedCandidates = Boolean(
    jobId && scopedCandidateIds && scopedCandidateIds.length === 0,
  );

  const [candidateRows, totalResult, statusCounts] = noScopedCandidates
    ? [[], [{ count: 0 }], [{ open: 0, inReview: 0, linked: 0, noMatch: 0 }]]
    : await Promise.all([
        db
          .select({
            id: candidates.id,
            name: candidates.name,
            role: candidates.role,
            location: candidates.location,
            headline: candidates.headline,
            profileSummary: candidates.profileSummary,
            source: candidates.source,
            resumeParsedAt: candidates.resumeParsedAt,
            matchingStatus: candidates.matchingStatus,
            lastMatchedAt: candidates.lastMatchedAt,
            matchingStatusUpdatedAt: candidates.matchingStatusUpdatedAt,
            createdAt: candidates.createdAt,
          })
          .from(candidates)
          .where(candidateListWhere)
          .orderBy(desc(candidates.matchingStatusUpdatedAt), desc(candidates.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ count: sql<number>`count(*)::int` }).from(candidates).where(candidateListWhere),
        db
          .select({
            open: sql<number>`count(*) filter (where ${candidates.matchingStatus} = 'open')::int`,
            inReview: sql<number>`count(*) filter (where ${candidates.matchingStatus} = 'in_review')::int`,
            linked: sql<number>`count(*) filter (where ${candidates.matchingStatus} = 'linked')::int`,
            noMatch: sql<number>`count(*) filter (where ${candidates.matchingStatus} = 'no_match')::int`,
          })
          .from(candidates)
          .where(candidateCountsWhere),
      ]);

  const totalCount = totalResult[0]?.count ?? 0;
  const totalPages = Math.ceil(totalCount / limit) || 1;
  const openCount = statusCounts[0]?.open ?? 0;
  const inReviewCount = statusCounts[0]?.inReview ?? 0;
  const linkedCount = statusCounts[0]?.linked ?? 0;
  const noMatchCount = statusCounts[0]?.noMatch ?? 0;
  const allCount = openCount + inReviewCount + linkedCount + noMatchCount;

  const candidateIds = candidateRows.map((candidate) => candidate.id);
  const [matchRows, applicationRows] =
    candidateIds.length === 0
      ? [[], []]
      : await Promise.all([
          db
            .select({
              candidateId: jobMatches.candidateId,
              matchId: jobMatches.id,
              matchScore: jobMatches.matchScore,
              confidence: jobMatches.confidence,
              reasoning: jobMatches.reasoning,
              recommendation: jobMatches.recommendation,
              recommendationConfidence: jobMatches.recommendationConfidence,
              assessmentModel: jobMatches.assessmentModel,
              criteriaBreakdown: jobMatches.criteriaBreakdown,
              riskProfile: jobMatches.riskProfile,
              enrichmentSuggestions: jobMatches.enrichmentSuggestions,
              reviewedAt: jobMatches.reviewedAt,
              status: jobMatches.status,
              jobId: jobs.id,
              jobTitle: jobs.title,
              company: jobs.company,
              location: jobs.location,
            })
            .from(jobMatches)
            .leftJoin(jobs, eq(jobMatches.jobId, jobs.id))
            .where(
              jobId
                ? and(inArray(jobMatches.candidateId, candidateIds), eq(jobMatches.jobId, jobId))
                : inArray(jobMatches.candidateId, candidateIds),
            )
            .orderBy(desc(jobMatches.matchScore)),
          db
            .select({
              candidateId: applications.candidateId,
              stage: applications.stage,
              createdAt: applications.createdAt,
              jobId: jobs.id,
              jobTitle: jobs.title,
              jobCompany: jobs.company,
            })
            .from(applications)
            .leftJoin(jobs, eq(applications.jobId, jobs.id))
            .where(
              jobId
                ? and(
                    inArray(applications.candidateId, candidateIds),
                    eq(applications.jobId, jobId),
                    isNull(applications.deletedAt),
                  )
                : and(
                    inArray(applications.candidateId, candidateIds),
                    isNull(applications.deletedAt),
                  ),
            )
            .orderBy(desc(applications.createdAt)),
        ]);

  const matchesByCandidate = new Map<string, typeof matchRows>();
  for (const row of matchRows) {
    if (!row.candidateId) continue;
    const bucket = matchesByCandidate.get(row.candidateId) ?? [];
    bucket.push(row);
    bucket.sort((left, right) => right.matchScore - left.matchScore);
    matchesByCandidate.set(row.candidateId, bucket);
  }

  const applicationsByCandidate = new Map<string, typeof applicationRows>();
  for (const row of applicationRows) {
    if (!row.candidateId) continue;
    const bucket = applicationsByCandidate.get(row.candidateId) ?? [];
    bucket.push(row);
    bucket.sort(
      (left, right) =>
        new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime(),
    );
    applicationsByCandidate.set(row.candidateId, bucket);
  }

  return (
    <MatchingShell tab={tab} jobId={jobId} jobContext={jobContext}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KPICard icon={<BarChart3 className="h-4 w-4" />} label="Totaal" value={allCount} />
        <KPICard
          icon={<Inbox className="h-4 w-4" />}
          label="Open"
          value={openCount}
          iconClassName="text-sky-600/70"
          valueClassName="text-sky-600"
        />
        <KPICard
          icon={<Clock className="h-4 w-4" />}
          label="In behandeling"
          value={inReviewCount}
          iconClassName="text-yellow-500/70"
          valueClassName="text-yellow-600"
        />
        <KPICard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Gekoppeld"
          value={linkedCount}
          iconClassName="text-primary/70"
          valueClassName="text-primary"
        />
        <KPICard
          icon={<XCircle className="h-4 w-4" />}
          label="Geen match"
          value={noMatchCount}
          iconClassName="text-muted-foreground"
          valueClassName="text-muted-foreground"
        />
      </div>

      <FilterTabs
        options={[
          { value: "", label: "Alles" },
          { value: "open", label: "Open" },
          { value: "in_review", label: "In behandeling" },
          { value: "linked", label: "Gekoppeld" },
          { value: "no_match", label: "Geen match" },
        ]}
        activeValue={statusFilter}
        buildHref={(value) => `/matching${buildQs(value ? { status: value } : {}, jobId)}`}
      />

      {jobContext && <CandidateLinker jobId={jobId} linkedCandidateIds={linkedCandidateIds} />}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{totalCount} kandidaten in de inbox</p>
        {totalPages > 1 && (
          <p className="text-sm text-muted-foreground">
            Pagina {page} van {totalPages}
          </p>
        )}
      </div>

      {candidateRows.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-8 w-8 opacity-40" />}
          title="Geen kandidaten gevonden"
          subtitle={
            statusFilter
              ? "Probeer een andere inboxstatus"
              : jobContext
                ? "Er zijn nog geen kandidaten voor deze vacature. Gebruik handmatig koppelen hierboven."
                : "Start met een nieuwe intake of bekijk kandidaten vanuit CV Analyse."
          }
        />
      ) : (
        <div className="space-y-4">
          {candidateRows.map((candidate) => {
            const candidateMatches = matchesByCandidate.get(candidate.id) ?? [];
            const topMatch = candidateMatches[0] ?? null;
            const candidateApplications = applicationsByCandidate.get(candidate.id) ?? [];
            const latestApplication = candidateApplications[0] ?? null;
            const alreadyInPipeline = Boolean(latestApplication);
            const matchScore = topMatch ? Math.round(topMatch.matchScore) : null;
            const matchConfidence =
              topMatch && topMatch.confidence !== null ? Math.round(topMatch.confidence) : null;
            const primarySummary =
              candidate.headline ??
              candidate.profileSummary ??
              (candidate.matchingStatus === "no_match"
                ? "Recruiter heeft nog geen passende opdracht geselecteerd."
                : "Profiel staat klaar voor verdere review of koppeling.");

            return (
              <div
                key={candidate.id}
                className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 transition-colors"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          inboxStatusColors[
                            candidate.matchingStatus as keyof typeof inboxStatusColors
                          ]
                        }
                      >
                        {inboxStatusLabels[
                          candidate.matchingStatus as keyof typeof inboxStatusLabels
                        ] ?? candidate.matchingStatus}
                      </Badge>
                      {candidate.source ? (
                        <Badge variant="outline" className="text-muted-foreground">
                          {sourceLabels[candidate.source] ?? candidate.source}
                        </Badge>
                      ) : null}
                      {candidate.resumeParsedAt ? (
                        <Badge variant="outline" className="text-muted-foreground">
                          CV geparsed
                        </Badge>
                      ) : null}
                      {candidateApplications.length > 0 ? (
                        <Badge variant="outline" className="text-muted-foreground">
                          {candidateApplications.length} pipeline-koppeling
                          {candidateApplications.length === 1 ? "" : "en"}
                        </Badge>
                      ) : null}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <Link
                          href={`/professionals/${candidate.id}`}
                          className="text-lg font-semibold text-foreground hover:text-primary transition-colors"
                        >
                          {candidate.name}
                        </Link>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {[candidate.role, candidate.location].filter(Boolean).join(" · ") ||
                          "Profiel in opbouw"}
                      </p>
                    </div>

                    <p className="text-sm leading-relaxed text-muted-foreground max-w-3xl">
                      {primarySummary}
                    </p>
                  </div>

                  <div className="shrink-0 text-sm text-muted-foreground space-y-1 xl:text-right">
                    <p>
                      Inbox bijgewerkt: {formatDate(candidate.matchingStatusUpdatedAt) ?? "Vandaag"}
                    </p>
                    {candidate.lastMatchedAt ? (
                      <p>Laatst gematcht: {formatDate(candidate.lastMatchedAt)}</p>
                    ) : (
                      <p>Nog niet opnieuw gematcht vanuit inbox</p>
                    )}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-[1.35fr,0.95fr]">
                  <section className="rounded-xl border border-border bg-muted/15 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Beste match nu
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {candidateMatches.length} match
                          {candidateMatches.length === 1 ? "" : "es"} beschikbaar
                        </p>
                      </div>
                      {topMatch?.status ? (
                        <Badge
                          variant="outline"
                          className={
                            reviewStatusColors[topMatch.status] ??
                            "border-border text-muted-foreground"
                          }
                        >
                          {reviewStatusLabels[topMatch.status] ?? topMatch.status}
                        </Badge>
                      ) : null}
                    </div>

                    {topMatch ? (
                      <>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            {topMatch.jobId ? (
                              <Link
                                href={`/opdrachten/${topMatch.jobId}`}
                                className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                              >
                                {topMatch.jobTitle ?? "Vacature"}
                              </Link>
                            ) : (
                              <p className="text-sm font-semibold text-foreground">
                                {topMatch.jobTitle ?? "Vacature"}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {[topMatch.company, topMatch.location].filter(Boolean).join(" · ") ||
                                "Vacaturecontext nog niet volledig beschikbaar"}
                            </p>
                          </div>
                          {topMatch.recommendation ? (
                            <Badge
                              variant="outline"
                              className="border-primary/20 bg-primary/10 text-primary"
                            >
                              {recommendationLabel(topMatch.recommendation)}
                            </Badge>
                          ) : null}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Match score</span>
                            <span className="font-medium text-foreground">{matchScore}%</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                (matchScore ?? 0) >= 80
                                  ? "bg-primary"
                                  : (matchScore ?? 0) >= 60
                                    ? "bg-yellow-500"
                                    : "bg-red-500"
                              }`}
                              style={{ width: `${Math.min(100, matchScore ?? 0)}%` }}
                            />
                          </div>
                          {matchConfidence !== null ? (
                            <p className="text-xs text-muted-foreground">
                              Aanbevelingszekerheid: {matchConfidence}%
                            </p>
                          ) : null}
                        </div>

                        {topMatch.reasoning ? (
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            <Sparkles className="inline h-3.5 w-3.5 mr-1 text-primary/70" />
                            {topMatch.reasoning}
                          </p>
                        ) : null}

                        {topMatch.assessmentModel === "marienne-v1" &&
                        topMatch.criteriaBreakdown ? (
                          <div className="pt-3 border-t border-border">
                            <MatchDetail
                              criteriaBreakdown={topMatch.criteriaBreakdown as CriterionResult[]}
                              overallScore={topMatch.matchScore}
                              knockoutsPassed={
                                !((topMatch.riskProfile as string[] | null) ?? []).some((risk) =>
                                  risk.toLowerCase().includes("knock"),
                                )
                              }
                              riskProfile={(topMatch.riskProfile as string[] | null) ?? []}
                              enrichmentSuggestions={
                                (topMatch.enrichmentSuggestions as string[] | null) ?? []
                              }
                              recommendation={(topMatch.recommendation as string) ?? "conditional"}
                              recommendationReasoning={topMatch.reasoning ?? ""}
                              recommendationConfidence={topMatch.recommendationConfidence ?? 0}
                            />
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <EmptyState
                        icon={<Inbox className="h-7 w-7 opacity-40" />}
                        title="Nog geen topmatch zichtbaar"
                        subtitle={
                          jobContext
                            ? "Gebruik handmatig koppelen of open de kandidaat voor een nieuwe review."
                            : "Open de kandidaat om matching opnieuw te starten zodra het profiel compleet is."
                        }
                      />
                    )}
                  </section>

                  <section className="rounded-xl border border-border bg-card p-4 space-y-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Pipeline & opvolging
                      </p>
                      {alreadyInPipeline ? (
                        <div className="mt-3 space-y-2">
                          <p className="text-sm font-medium text-foreground">
                            {stageLabels[latestApplication.stage ?? ""] ?? latestApplication.stage}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {latestApplication.jobTitle ?? "Vacature verwijderd"}
                            {latestApplication.jobCompany
                              ? ` · ${latestApplication.jobCompany}`
                              : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Laatste koppeling op{" "}
                            {formatDate(latestApplication.createdAt) ?? "onbekend"}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-muted-foreground">
                          Nog geen actieve pipeline-koppeling. Deze kandidaat blijft zichtbaar in de
                          inbox totdat een recruiter actie neemt.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/professionals/${candidate.id}`}>Open kandidaat</Link>
                      </Button>
                      {topMatch?.jobId ? (
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/opdrachten/${topMatch.jobId}`}>
                            Open opdracht
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      ) : null}
                      {topMatch?.assessmentModel === "marienne-v1" &&
                      Boolean(topMatch.criteriaBreakdown) ? (
                        <ReportButton matchId={topMatch.matchId} />
                      ) : null}
                      {topMatch?.status === "pending" && !alreadyInPipeline ? (
                        <MatchActions matchId={topMatch.matchId} />
                      ) : null}
                    </div>

                    {topMatch?.reviewedAt ? (
                      <p className="text-xs text-muted-foreground">
                        Laatst beoordeeld op {formatDate(topMatch.reviewedAt) ?? "onbekend"}
                      </p>
                    ) : null}
                  </section>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        buildHref={(nextPage) => {
          const base: Record<string, string> = {
            ...(statusFilter ? { status: statusFilter } : {}),
            pagina: String(nextPage),
          };
          if (limit !== DEFAULT_PER_PAGE) base.limit = String(limit);
          return `/matching${buildQs(base, jobId)}`;
        }}
      />

      <div className="h-8" />
    </MatchingShell>
  );
}
