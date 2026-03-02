import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { Briefcase, CheckCircle2, Filter, Inbox, Kanban, List, Users, XCircle } from "lucide-react";
import Link from "next/link";
import { KanbanBoard } from "@/components/pipeline/kanban-board";
import type { KanbanCardData } from "@/components/pipeline/kanban-card";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { KPICard } from "@/components/shared/kpi-card";
import { Pagination } from "@/components/shared/pagination";
import { Badge } from "@/components/ui/badge";
import { db } from "@/src/db";
import { applications, candidates, jobMatches, jobs } from "@/src/db/schema";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    fase?: string;
    pagina?: string;
    weergave?: string;
  }>;
}

const PER_PAGE = 20;

const stageColors: Record<string, string> = {
  new: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  screening: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  interview: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  offer: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  hired: "bg-primary/10 text-primary border-primary/20",
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

const KANBAN_STAGES = ["new", "screening", "interview", "offer", "hired"] as const;

export default async function PipelinePage({ searchParams }: Props) {
  const params = await searchParams;
  const stageFilter = params.fase ?? "";
  const page = Math.max(1, parseInt(params.pagina ?? "1", 10));
  const offset = (page - 1) * PER_PAGE;
  const view = params.weergave === "lijst" ? "lijst" : "kanban";

  // Build where clause for list view
  const conditions = [isNull(applications.deletedAt)];
  if (stageFilter) {
    conditions.push(eq(applications.stage, stageFilter));
  }
  const whereClause = and(...conditions);

  // Fetch applications + KPIs in parallel
  const [
    rows,
    totalResult,
    newResult,
    screeningResult,
    interviewResult,
    offerResult,
    hiredResult,
    kanbanRows,
  ] = await Promise.all([
    // List view data (only if list view)
    view === "lijst"
      ? db
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
          .offset(offset)
      : Promise.resolve([]),
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
    // Kanban data (only if kanban view) — all non-deleted applications for kanban stages
    view === "kanban"
      ? db
          .select({
            id: applications.id,
            stage: applications.stage,
            candidateId: applications.candidateId,
            candidateName: candidates.name,
            candidateEmail: candidates.email,
            jobTitle: jobs.title,
            jobCompany: jobs.company,
            source: applications.source,
            createdAt: applications.createdAt,
            matchId: applications.matchId,
            matchScore: jobMatches.matchScore,
          })
          .from(applications)
          .leftJoin(jobs, eq(applications.jobId, jobs.id))
          .leftJoin(candidates, eq(applications.candidateId, candidates.id))
          .leftJoin(jobMatches, eq(applications.matchId, jobMatches.id))
          .where(isNull(applications.deletedAt))
          .orderBy(desc(applications.createdAt))
      : Promise.resolve([]),
  ]);

  const totalCount = totalResult[0]?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PER_PAGE);
  const newCount = newResult[0]?.count ?? 0;
  const screeningCount = screeningResult[0]?.count ?? 0;
  const interviewCount = interviewResult[0]?.count ?? 0;
  const offerCount = offerResult[0]?.count ?? 0;
  const hiredCount = hiredResult[0]?.count ?? 0;
  const allCount = newCount + screeningCount + interviewCount + offerCount + hiredCount;

  // Group kanban data by stage
  const byStage: Record<string, KanbanCardData[]> = {};
  for (const stage of KANBAN_STAGES) {
    byStage[stage] = [];
  }
  for (const row of kanbanRows) {
    const stage = row.stage;
    if (!byStage[stage]) byStage[stage] = [];
    byStage[stage].push({
      id: row.id,
      candidateId: row.candidateId,
      candidateName: row.candidateName,
      candidateEmail: row.candidateEmail,
      jobTitle: row.jobTitle,
      jobCompany: row.jobCompany,
      source: row.source,
      createdAt: row.createdAt?.toISOString() ?? null,
      matchScore: row.matchScore,
    });
  }

  function buildViewHref(v: string): string {
    const p = new URLSearchParams();
    if (v !== "kanban") p.set("weergave", v);
    if (stageFilter) p.set("fase", stageFilter);
    const qs = p.toString();
    return `/pipeline${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Pipeline</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sollicitatiepipeline — volg kandidaten door elke fase
            </p>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
            <Link
              href={buildViewHref("kanban")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                view === "kanban"
                  ? "bg-card text-foreground shadow-sm font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Kanban className="h-3.5 w-3.5" />
              Kanban
            </Link>
            <Link
              href={buildViewHref("lijst")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                view === "lijst"
                  ? "bg-card text-foreground shadow-sm font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="h-3.5 w-3.5" />
              Lijst
            </Link>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPICard icon={<Briefcase className="h-4 w-4" />} label="Totaal" value={allCount} />
          <KPICard
            icon={<Inbox className="h-4 w-4" />}
            label="Nieuw"
            value={newCount}
            iconClassName="text-yellow-500/60"
            valueClassName="text-yellow-500"
          />
          <KPICard
            icon={<Filter className="h-4 w-4" />}
            label="Screening"
            value={screeningCount}
            iconClassName="text-blue-500/60"
            valueClassName="text-blue-500"
          />
          <KPICard
            icon={<Users className="h-4 w-4" />}
            label="Interview"
            value={interviewCount}
            iconClassName="text-purple-500/60"
            valueClassName="text-purple-500"
          />
          <KPICard
            icon={<Briefcase className="h-4 w-4" />}
            label="Aanbod"
            value={offerCount}
            iconClassName="text-orange-500/60"
            valueClassName="text-orange-500"
          />
          <KPICard
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Geplaatst"
            value={hiredCount}
            iconClassName="text-primary/60"
            valueClassName="text-primary"
          />
        </div>

        {/* KANBAN VIEW */}
        {view === "kanban" ? (
          <KanbanBoard byStage={byStage} />
        ) : (
          <>
            {/* Stage filter tabs (list view only) */}
            <FilterTabs
              options={[
                { value: "", label: "Alle" },
                { value: "new", label: "Nieuw" },
                { value: "screening", label: "Screening" },
                { value: "interview", label: "Interview" },
                { value: "offer", label: "Aanbod" },
                { value: "hired", label: "Geplaatst" },
                { value: "rejected", label: "Afgewezen" },
              ]}
              activeValue={stageFilter}
              buildHref={(v) =>
                `/pipeline?${new URLSearchParams({ weergave: "lijst", ...(v ? { fase: v } : {}) }).toString()}`
              }
            />

            {/* Results count */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{totalCount} sollicitaties gevonden</p>
              {totalPages > 1 && (
                <p className="text-sm text-muted-foreground">
                  Pagina {page} van {totalPages}
                </p>
              )}
            </div>

            {/* Application cards */}
            {rows.length === 0 ? (
              <EmptyState
                icon={<Inbox className="h-8 w-8 opacity-40" />}
                title="Geen sollicitaties gevonden"
                subtitle={
                  stageFilter
                    ? "Probeer een ander fasefilter"
                    : "Start met het matchen van kandidaten aan vacatures"
                }
              />
            ) : (
              <div className="space-y-3">
                {rows.map((row) => {
                  const stage = row.application.stage;
                  const StageIcon = stageIcons[stage] ?? Inbox;

                  return (
                    <div
                      key={row.application.id}
                      className="bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:bg-accent transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        {/* Left: candidate + job info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-semibold text-foreground">
                              {row.candidateName ?? "Kandidaat verwijderd"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {row.jobTitle ?? "Vacature verwijderd"}
                              {row.jobCompany && (
                                <span className="text-muted-foreground"> bij {row.jobCompany}</span>
                              )}
                            </span>
                          </div>

                          {/* Meta row */}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
                            className={`text-[10px] flex items-center gap-1 ${stageColors[stage] ?? "border-border text-muted-foreground"}`}
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
            <Pagination
              page={page}
              totalPages={totalPages}
              buildHref={(p) =>
                `/pipeline?${new URLSearchParams({
                  weergave: "lijst",
                  ...(stageFilter ? { fase: stageFilter } : {}),
                  pagina: String(p),
                }).toString()}`
              }
            />
          </>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
}
