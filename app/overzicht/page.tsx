import {
  Activity,
  ArrowRight,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Inbox,
  Kanban,
  MapPin,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, Suspense } from "react";
import { KPICard } from "@/components/shared/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getOverviewData } from "./data";

export const revalidate = 60;

const PRIORITY_TONE_STYLES = {
  amber: {
    icon: "bg-yellow-500/10 text-yellow-600",
    value: "text-yellow-600",
  },
  blue: {
    icon: "bg-blue-500/10 text-blue-600",
    value: "text-blue-600",
  },
  purple: {
    icon: "bg-purple-500/10 text-purple-600",
    value: "text-purple-600",
  },
  green: {
    icon: "bg-emerald-500/10 text-emerald-600",
    value: "text-emerald-600",
  },
} as const;

async function DashboardContent() {
  const {
    dedupedTotal,
    platformCounts,
    recentJobs,
    activeScrapers,
    recentScrapes,
    pipelineStageCounts,
    upcomingInterviewCountResult,
    upcomingInterviews,
  } = await getOverviewData();

  const totalJobs = dedupedTotal;
  const weeklyNew = platformCounts.reduce((sum, row) => sum + row.weeklyNew, 0);

  const pipelineMap: Record<string, number> = {};
  for (const row of pipelineStageCounts) {
    pipelineMap[row.stage] = row.count;
  }

  const pipelineNew = pipelineMap.new ?? 0;
  const pipelineScreening = pipelineMap.screening ?? 0;
  const pipelineInterview = pipelineMap.interview ?? 0;
  const pipelineOffer = pipelineMap.offer ?? 0;
  const pipelineHired = pipelineMap.hired ?? 0;
  const pipelineTotal =
    pipelineNew + pipelineScreening + pipelineInterview + pipelineOffer + pipelineHired;

  const upcomingInterviewsCount = upcomingInterviewCountResult[0]?.count ?? 0;

  const recruiterFocus = [
    {
      title: "Nieuwe kandidaten screenen",
      description: "Nieuwe instroom wacht op een eerste beoordeling in de pipeline.",
      value: pipelineNew,
      href: "/pipeline?fase=new&weergave=lijst",
      icon: <Inbox className="h-4 w-4" />,
      tone: "amber" as const,
    },
    {
      title: "Screenings afronden",
      description: "Kandidaten in screening hebben feedback of een volgende stap nodig.",
      value: pipelineScreening,
      href: "/pipeline?fase=screening&weergave=lijst",
      icon: <Filter className="h-4 w-4" />,
      tone: "blue" as const,
    },
    {
      title: "Aankomende interviews",
      description: "Bereid gesprekken voor en bewaak planning voor vandaag en daarna.",
      value: upcomingInterviewsCount,
      href: "/interviews",
      icon: <Calendar className="h-4 w-4" />,
      tone: "purple" as const,
    },
    {
      title: "Nieuwe vacatures opvolgen",
      description: "Bekijk verse instroom en bepaal direct waar sourcing of matching nodig is.",
      value: weeklyNew,
      href: "/vacatures",
      icon: <Briefcase className="h-4 w-4" />,
      tone: "green" as const,
    },
  ];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          icon={<Briefcase className="h-5 w-5" />}
          label="Open vacatures"
          value={totalJobs}
          href="/vacatures"
        />
        <KPICard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Nieuw deze week"
          value={weeklyNew}
          iconClassName="text-primary/60"
          valueClassName="text-primary"
          href="/vacatures"
        />
        <KPICard
          icon={<Kanban className="h-5 w-5" />}
          label="Kandidaten in pipeline"
          value={pipelineTotal}
          iconClassName="text-blue-500/60"
          valueClassName="text-blue-500"
          href="/pipeline"
        />
        <KPICard
          icon={<Calendar className="h-5 w-5" />}
          label="Geplande interviews"
          value={upcomingInterviewsCount}
          iconClassName="text-purple-500/60"
          valueClassName="text-purple-500"
          href="/interviews"
        />
      </div>

      <DashboardCard title="Wat vraagt nu aandacht?" icon={<Clock className="h-4 w-4" />}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {recruiterFocus.map((item) => (
            <PriorityLinkCard key={item.title} {...item} />
          ))}
        </div>
      </DashboardCard>

      <div className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
        <div className="space-y-6">
          <DashboardCard
            title="Pipeline waar je op stuurt"
            icon={<Kanban className="h-4 w-4" />}
            action={
              <Link
                href="/pipeline"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Open pipeline <ArrowRight className="h-3 w-3" />
              </Link>
            }
          >
            {pipelineTotal === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                Nog geen kandidaten in de pipeline. Start vanuit vacatures of open het
                kandidatenoverzicht.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <KPICard
                  icon={<Inbox className="h-4 w-4" />}
                  label="Nieuw"
                  value={pipelineNew}
                  compact
                  iconClassName="text-yellow-500/60"
                  valueClassName="text-yellow-500"
                  href="/pipeline?fase=new&weergave=lijst"
                />
                <KPICard
                  icon={<Filter className="h-4 w-4" />}
                  label="Screening"
                  value={pipelineScreening}
                  compact
                  iconClassName="text-blue-500/60"
                  valueClassName="text-blue-500"
                  href="/pipeline?fase=screening&weergave=lijst"
                />
                <KPICard
                  icon={<Users className="h-4 w-4" />}
                  label="Interview"
                  value={pipelineInterview}
                  compact
                  iconClassName="text-purple-500/60"
                  valueClassName="text-purple-500"
                  href="/pipeline?fase=interview&weergave=lijst"
                />
                <KPICard
                  icon={<Briefcase className="h-4 w-4" />}
                  label="Aanbod"
                  value={pipelineOffer}
                  compact
                  iconClassName="text-orange-500/60"
                  valueClassName="text-orange-500"
                  href="/pipeline?fase=offer&weergave=lijst"
                />
                <KPICard
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  label="Geplaatst"
                  value={pipelineHired}
                  compact
                  iconClassName="text-primary/60"
                  valueClassName="text-primary"
                  href="/pipeline?fase=hired&weergave=lijst"
                />
              </div>
            )}
          </DashboardCard>

          <DashboardCard
            title="Nieuwe vacatures om op te volgen"
            icon={<Briefcase className="h-4 w-4" />}
            action={
              <Link
                href="/vacatures"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Alle vacatures <ArrowRight className="h-3 w-3" />
              </Link>
            }
          >
            {recentJobs.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">Nog geen vacatures beschikbaar.</p>
            ) : (
              <div className="divide-y divide-border">
                {recentJobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/vacatures/${job.id}`}
                    className="flex items-start justify-between gap-3 px-4 py-3 transition-colors first:pt-0 last:pb-0 hover:bg-accent -mx-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{job.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {job.company && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {job.company}
                          </span>
                        )}
                        {job.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {job.location}
                          </span>
                        )}
                        {job.scrapedAt && <span>{formatDateTime(job.scrapedAt)}</span>}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="ml-3 shrink-0 border-border text-[10px] capitalize text-muted-foreground"
                    >
                      {job.platform}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </DashboardCard>
        </div>

        <div className="space-y-6">
          <DashboardCard
            title="Aankomende interviews"
            icon={<Calendar className="h-4 w-4" />}
            action={
              <Link
                href="/interviews"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Bekijk agenda <ArrowRight className="h-3 w-3" />
              </Link>
            }
          >
            {upcomingInterviews.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                Geen interviews gepland. Plan gesprekken vanuit de pipeline.
              </p>
            ) : (
              <div className="space-y-2">
                {upcomingInterviews.map((interview) => (
                  <Link
                    key={interview.id}
                    href="/interviews"
                    className="block rounded-lg border border-border px-3 py-3 transition-colors hover:border-primary/30 hover:bg-accent"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {interview.candidateName ?? "Onbekende kandidaat"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {interview.jobTitle ?? "Onbekende vacature"}
                          {interview.jobCompany ? ` · ${interview.jobCompany}` : ""}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 border-border text-[10px]">
                        {interview.type}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatDateTime(interview.scheduledAt)}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </DashboardCard>
        </div>
      </div>

      <div className="grid gap-6">
        <DashboardCard
          title="Databronnen"
          icon={<RefreshCw className="h-4 w-4" />}
          action={
            <Link
              href="/scraper"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Scraper dashboard <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <KPICard
              icon={<RefreshCw className="h-4 w-4" />}
              label="Actieve bronnen"
              value={activeScrapers.length}
              compact
              href="/scraper"
            />
            <KPICard
              icon={<Activity className="h-4 w-4" />}
              label="Platformen"
              value={platformCounts.length}
              compact
              href="/scraper"
            />
          </div>
          <div className="mt-4 space-y-1">
            {recentScrapes.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                Nog geen bronactiviteit beschikbaar.
              </p>
            ) : (
              recentScrapes.map((scrape) => {
                const skipped =
                  (scrape.jobsFound ?? 0) - (scrape.jobsNew ?? 0) - (scrape.duplicates ?? 0);

                return (
                  <Link
                    key={scrape.id}
                    href="/scraper"
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          scrape.status === "success"
                            ? "bg-primary"
                            : scrape.status === "failed"
                              ? "bg-red-500"
                              : "bg-yellow-500"
                        }`}
                      />
                      <span className="truncate text-sm capitalize text-foreground">
                        {scrape.platform}
                      </span>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{scrape.jobsNew ?? 0} nieuw</p>
                      <p>
                        {scrape.jobsFound ?? 0} gevonden
                        {skipped > 0 ? ` · ${skipped} overgeslagen` : ""}
                      </p>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </DashboardCard>
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* KPI Cards Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-8 w-12" />
            </div>
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>

      {/* "Wat vraagt nu aandacht?" Skeleton */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-5 w-40" />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <div key={i} className="rounded-xl border border-border bg-accent/20 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <Skeleton className="h-8 w-8" />
              </div>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      </div>

      {/* Grid Skeleton */}
      <div className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <div key={i} className="rounded-xl border border-border bg-card p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-5 w-40" />
                </div>
              </div>
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                  <Skeleton key={j} className="h-12 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-5 w-40" />
              </div>
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Databronnen Skeleton */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-5 w-40" />
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function OverzichtPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 md:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Overzicht</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Je command center voor vacatures, kandidaten en opvolging.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Vacatures", href: "/vacatures" },
              { label: "Pipeline", href: "/pipeline" },
              { label: "Interviews", href: "/interviews" },
            ].map((shortcut) => (
              <Link
                key={shortcut.href}
                href={shortcut.href}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {shortcut.label}
                <ArrowRight className="h-3 w-3" />
              </Link>
            ))}
          </div>
        </div>

        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardContent />
        </Suspense>
      </div>
    </div>
  );
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "Onbekend moment";

  return new Date(value).toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DashboardCard({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function PriorityLinkCard({
  title,
  description,
  value,
  href,
  icon,
  tone,
}: {
  title: string;
  description: string;
  value: number;
  href: string;
  icon: ReactNode;
  tone: keyof typeof PRIORITY_TONE_STYLES;
}) {
  const styles = PRIORITY_TONE_STYLES[tone];

  return (
    <Link
      href={href}
      className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${styles.icon}`}>
          {icon}
        </div>
        <span className={`text-2xl font-bold ${styles.value}`}>{value}</span>
      </div>
      <h4 className="mt-3 text-sm font-semibold text-foreground">{title}</h4>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </Link>
  );
}
