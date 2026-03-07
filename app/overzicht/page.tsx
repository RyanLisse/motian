import { sql } from "drizzle-orm";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  Filter,
  Inbox,
  Kanban,
  MapPin,
  RefreshCw,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { KPICard } from "@/components/shared/kpi-card";
import { Badge } from "@/components/ui/badge";
import { db } from "@/src/db";

export const dynamic = "force-dynamic";

type PlatformCount = {
  platform: string;
  count: number;
  weeklyNew: number;
};

type RecentJob = {
  id: string;
  title: string;
  company: string | null;
  platform: string;
  location: string | null;
  scrapedAt: string | Date | null;
};

type ActiveScraper = {
  platform: string;
};

type RecentScrape = {
  id: string;
  configId: string | null;
  platform: string;
  runAt: string | Date | null;
  durationMs: number | null;
  jobsFound: number | null;
  jobsNew: number | null;
  duplicates: number | null;
  status: string;
  errors: unknown;
};

type CompanyCount = {
  company: string | null;
  count: number;
};

type ProvinceCount = {
  province: string | null;
  count: number;
};

type PipelineStageCount = {
  stage: string;
  count: number;
};

export default async function OverzichtPage() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Collapse dashboard fan-out into two round-trips so Sentry does not see this route as N+1-like.
  const [jobsDashboardResult, scraperDashboardResult] = await Promise.all([
    db.execute(sql`
      WITH filtered_jobs AS (
        SELECT
          id,
          title,
          company,
          platform,
          location,
          province,
          scraped_at AS "scrapedAt"
        FROM jobs
        WHERE deleted_at IS NULL
      ),
      platform_counts AS (
        SELECT
          platform,
          count(*)::int AS count,
          count(*) FILTER (WHERE "scrapedAt" >= ${sevenDaysAgo})::int AS "weeklyNew"
        FROM filtered_jobs
        GROUP BY platform
      ),
      recent_jobs AS (
        SELECT id, title, company, platform, location, "scrapedAt"
        FROM filtered_jobs
        ORDER BY "scrapedAt" DESC
        LIMIT 5
      ),
      top_companies AS (
        SELECT company, count(*)::int AS count
        FROM filtered_jobs
        WHERE company IS NOT NULL
        GROUP BY company
        ORDER BY count(*) DESC
        LIMIT 5
      ),
      location_counts AS (
        SELECT province, count(*)::int AS count
        FROM filtered_jobs
        WHERE province IS NOT NULL
        GROUP BY province
        ORDER BY count(*) DESC
        LIMIT 5
      ),
      pipeline_stage_counts AS (
        SELECT stage, count(*)::int AS count
        FROM applications
        WHERE deleted_at IS NULL
        GROUP BY stage
      )
      SELECT
        coalesce(
          (SELECT json_agg(pc ORDER BY pc.count DESC) FROM platform_counts pc),
          '[]'::json
        ) AS "platformCounts",
        coalesce(
          (SELECT json_agg(rj ORDER BY rj."scrapedAt" DESC) FROM recent_jobs rj),
          '[]'::json
        ) AS "recentJobs",
        coalesce(
          (SELECT json_agg(tc ORDER BY tc.count DESC) FROM top_companies tc),
          '[]'::json
        ) AS "topCompanies",
        coalesce(
          (SELECT json_agg(lc ORDER BY lc.count DESC) FROM location_counts lc),
          '[]'::json
        ) AS "locationCounts",
        coalesce(
          (SELECT json_agg(psc ORDER BY psc.stage) FROM pipeline_stage_counts psc),
          '[]'::json
        ) AS "pipelineStageCounts"
    `),
    db.execute(sql`
      WITH active_scrapers AS (
        SELECT platform
        FROM scraper_configs
        WHERE is_active = true
      ),
      recent_scrapes AS (
        SELECT
          id,
          config_id AS "configId",
          platform,
          run_at AS "runAt",
          duration_ms AS "durationMs",
          jobs_found AS "jobsFound",
          jobs_new AS "jobsNew",
          duplicates,
          status,
          errors
        FROM scrape_results
        ORDER BY run_at DESC
        LIMIT 5
      )
      SELECT
        coalesce(
          (SELECT json_agg(s ORDER BY s.platform) FROM active_scrapers s),
          '[]'::json
        ) AS "activeScrapers",
        coalesce(
          (SELECT json_agg(rs ORDER BY rs."runAt" DESC) FROM recent_scrapes rs),
          '[]'::json
        ) AS "recentScrapes"
    `),
  ]);

  const jobsDashboard = (jobsDashboardResult.rows[0] ?? {}) as {
    platformCounts?: PlatformCount[];
    recentJobs?: RecentJob[];
    topCompanies?: CompanyCount[];
    locationCounts?: ProvinceCount[];
    pipelineStageCounts?: PipelineStageCount[];
  };
  const scraperDashboard = (scraperDashboardResult.rows[0] ?? {}) as {
    activeScrapers?: ActiveScraper[];
    recentScrapes?: RecentScrape[];
  };

  const platformCounts = jobsDashboard.platformCounts ?? [];
  const recentJobs = jobsDashboard.recentJobs ?? [];
  const topCompanies = jobsDashboard.topCompanies ?? [];
  const locationCounts = jobsDashboard.locationCounts ?? [];
  const pipelineStageCounts = jobsDashboard.pipelineStageCounts ?? [];
  const activeScrapers = scraperDashboard.activeScrapers ?? [];
  const recentScrapes = scraperDashboard.recentScrapes ?? [];

  const totalJobs = platformCounts.reduce((s, p) => s + p.count, 0);
  const weeklyNew = platformCounts.reduce((s, p) => s + p.weeklyNew, 0);

  // Pipeline stats
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

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Overzicht</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Dashboard — realtime inzicht in vacatures en scrapers
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            icon={<Briefcase className="h-5 w-5" />}
            label="Totaal vacatures"
            value={totalJobs}
            href="/opdrachten"
          />
          <KPICard
            icon={<TrendingUp className="h-5 w-5" />}
            label="Nieuw deze week"
            value={weeklyNew}
            iconClassName="text-primary/60"
            valueClassName="text-primary"
            href="/opdrachten"
          />
          <KPICard
            icon={<RefreshCw className="h-5 w-5" />}
            label="Actieve scrapers"
            value={activeScrapers.length}
            href="/scraper"
          />
          <KPICard
            icon={<Zap className="h-5 w-5" />}
            label="Platforms"
            value={platformCounts.length}
            href="/scraper"
          />
        </div>

        {/* Pipeline overview */}
        {pipelineTotal > 0 && (
          <DashboardCard
            title="Pipeline overzicht"
            icon={<Kanban className="h-4 w-4" />}
            action={
              <Link
                href="/pipeline"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Bekijk pipeline <ArrowRight className="h-3 w-3" />
              </Link>
            }
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
          </DashboardCard>
        )}

        {/* Main grid: 2 columns */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: 2/3 width */}
          <div className="lg:col-span-2 space-y-6">
            {/* Platform breakdown */}
            <DashboardCard title="Vacatures per platform" icon={<BarChart3 className="h-4 w-4" />}>
              <div className="space-y-1">
                {platformCounts.map((p) => {
                  const percentage = totalJobs > 0 ? Math.round((p.count / totalJobs) * 100) : 0;
                  return (
                    <Link
                      key={p.platform}
                      href={`/opdrachten?platform=${encodeURIComponent(p.platform)}`}
                      className="flex items-center gap-3 hover:bg-accent -mx-2 px-2 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <span
                        className="text-sm text-foreground capitalize w-20 sm:w-36 shrink-0 truncate"
                        title={p.platform}
                      >
                        {p.platform}
                      </span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-16 text-right">
                        {p.count} ({percentage}%)
                      </span>
                    </Link>
                  );
                })}
              </div>
            </DashboardCard>

            {/* Recent jobs */}
            <DashboardCard
              title="Laatst toegevoegd"
              icon={<Clock className="h-4 w-4" />}
              action={
                <Link
                  href="/opdrachten"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  Alle vacatures <ArrowRight className="h-3 w-3" />
                </Link>
              }
            >
              <div className="divide-y divide-border">
                {recentJobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/opdrachten/${job.id}`}
                    className="flex items-start justify-between py-3 first:pt-0 last:pb-0 hover:bg-card -mx-4 px-4 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{job.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
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
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="shrink-0 ml-3 text-[9px] border-border text-muted-foreground capitalize"
                    >
                      {job.platform}
                    </Badge>
                  </Link>
                ))}
              </div>
            </DashboardCard>

            {/* Recent scrapes */}
            <DashboardCard
              title="Scrape activiteit"
              icon={<Activity className="h-4 w-4" />}
              action={
                <Link
                  href="/scraper"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  Scraper dashboard <ArrowRight className="h-3 w-3" />
                </Link>
              }
            >
              {recentScrapes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nog geen scrape resultaten
                </p>
              ) : (
                <div className="space-y-0.5">
                  {recentScrapes.map((s) => (
                    <Link
                      key={s.id}
                      href="/scraper"
                      className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between py-2 hover:bg-accent -mx-2 px-2 rounded-lg transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-2 w-2 rounded-full ${
                            s.status === "success"
                              ? "bg-primary"
                              : s.status === "failed"
                                ? "bg-red-500"
                                : "bg-yellow-500"
                          }`}
                        />
                        <span className="text-sm text-foreground capitalize">{s.platform}</span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-4 text-xs text-muted-foreground flex-wrap">
                        <span>{s.jobsNew ?? 0} nieuw</span>
                        <span>{s.jobsFound ?? 0} gevonden</span>
                        {(() => {
                          const skipped =
                            (s.jobsFound ?? 0) - (s.jobsNew ?? 0) - (s.duplicates ?? 0);
                          return skipped > 0 ? (
                            <span title="Validatiefout of niet opgeslagen">
                              {skipped} overgeslagen
                            </span>
                          ) : null;
                        })()}
                        {s.runAt && (
                          <span>
                            {new Date(s.runAt).toLocaleString("nl-NL", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </DashboardCard>
          </div>

          {/* Right: 1/3 width */}
          <div className="space-y-6">
            {/* Top companies */}
            <DashboardCard title="Top opdrachtgevers" icon={<Building2 className="h-4 w-4" />}>
              <div className="space-y-0.5">
                {topCompanies.map((c, i) => (
                  <Link
                    key={c.company}
                    href={`/opdrachten?q=${encodeURIComponent(c.company ?? "")}`}
                    className="flex items-center justify-between hover:bg-accent -mx-2 px-2 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                      <span className="text-sm text-foreground truncate">{c.company}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className="shrink-0 ml-2 text-[10px] border-border text-muted-foreground"
                    >
                      {c.count}
                    </Badge>
                  </Link>
                ))}
              </div>
            </DashboardCard>

            {/* Top locations */}
            <DashboardCard title="Top provincies" icon={<MapPin className="h-4 w-4" />}>
              <div className="space-y-0.5">
                {locationCounts.map((l, i) => (
                  <Link
                    key={l.province}
                    href={`/opdrachten?provincie=${encodeURIComponent(l.province ?? "")}`}
                    className="flex items-center justify-between hover:bg-accent -mx-2 px-2 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                      <span className="text-sm text-foreground truncate">{l.province}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className="shrink-0 ml-2 text-[10px] border-border text-muted-foreground"
                    >
                      {l.count}
                    </Badge>
                  </Link>
                ))}
              </div>
            </DashboardCard>

            {/* System status — derived from actual scrape results */}
            <DashboardCard title="Systeem status" icon={<Zap className="h-4 w-4" />}>
              <div className="space-y-1">
                <StatusRow label="Database" status="online" />
                {activeScrapers.map((s) => {
                  const lastRun = recentScrapes.find((r) => r.platform === s.platform);
                  const isHealthy = lastRun ? lastRun.status !== "failed" : false;
                  return (
                    <Link
                      key={s.platform}
                      href="/scraper"
                      className="block hover:bg-accent -mx-2 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      <StatusRow
                        label={`${s.platform.charAt(0).toUpperCase()}${s.platform.slice(1)} scraper`}
                        status={isHealthy ? "online" : "offline"}
                      />
                    </Link>
                  );
                })}
              </div>
            </DashboardCard>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────

function DashboardCard({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
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

function StatusRow({ label, status }: { label: string; status: "online" | "offline" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <div
          className={`h-1.5 w-1.5 rounded-full ${
            status === "online" ? "bg-primary animate-pulse" : "bg-muted-foreground"
          }`}
        />
        <span
          className={`text-xs font-mono ${
            status === "online" ? "text-primary" : "text-muted-foreground"
          }`}
        >
          {status === "online" ? "Online" : "Offline"}
        </span>
      </div>
    </div>
  );
}
