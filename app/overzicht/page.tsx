import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Briefcase,
  Building2,
  Clock,
  MapPin,
  RefreshCw,
  TrendingUp,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { KPICard } from "@/components/shared/kpi-card";
import { Badge } from "@/components/ui/badge";
import { db } from "@/src/db";
import { jobs, scrapeResults, scraperConfigs } from "@/src/db/schema";

export const dynamic = "force-dynamic";

export default async function OverzichtPage() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Fetch all dashboard data in parallel (consolidated counts to reduce DB connections)
  const [platformCounts, recentJobs, activeScrapers, recentScrapes, topCompanies, locationCounts] =
    await Promise.all([
      // Jobs per platform (includes weeklyNew to eliminate separate jobStats query)
      db
        .select({
          platform: jobs.platform,
          count: sql<number>`count(*)::int`,
          weeklyNew: sql<number>`count(*) filter (where ${jobs.scrapedAt} >= ${sevenDaysAgo})::int`,
        })
        .from(jobs)
        .where(isNull(jobs.deletedAt))
        .groupBy(jobs.platform)
        .orderBy(sql`count(*) desc`),
      // Last 5 jobs
      db
        .select({
          id: jobs.id,
          title: jobs.title,
          company: jobs.company,
          platform: jobs.platform,
          location: jobs.location,
          scrapedAt: jobs.scrapedAt,
        })
        .from(jobs)
        .where(isNull(jobs.deletedAt))
        .orderBy(desc(jobs.scrapedAt))
        .limit(5),
      // Active scraper configs
      db.select().from(scraperConfigs).where(eq(scraperConfigs.isActive, true)),
      // Recent scrape results
      db.select().from(scrapeResults).orderBy(desc(scrapeResults.runAt)).limit(5),
      // Top companies by job count
      db
        .select({
          company: jobs.company,
          count: sql<number>`count(*)::int`,
        })
        .from(jobs)
        .where(and(isNull(jobs.deletedAt), sql`${jobs.company} is not null`))
        .groupBy(jobs.company)
        .orderBy(sql`count(*) desc`)
        .limit(5),
      // Top locations
      db
        .select({
          province: jobs.province,
          count: sql<number>`count(*)::int`,
        })
        .from(jobs)
        .where(and(isNull(jobs.deletedAt), sql`${jobs.province} is not null`))
        .groupBy(jobs.province)
        .orderBy(sql`count(*) desc`)
        .limit(5),
    ]);

  const totalJobs = platformCounts.reduce((s, p) => s + p.count, 0);
  const weeklyNew = platformCounts.reduce((s, p) => s + p.weeklyNew, 0);

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
          />
          <KPICard
            icon={<TrendingUp className="h-5 w-5" />}
            label="Nieuw deze week"
            value={weeklyNew}
            iconClassName="text-primary/60"
            valueClassName="text-primary"
          />
          <KPICard
            icon={<RefreshCw className="h-5 w-5" />}
            label="Actieve scrapers"
            value={activeScrapers.length}
          />
          <KPICard
            icon={<Zap className="h-5 w-5" />}
            label="Platforms"
            value={platformCounts.length}
          />
        </div>

        {/* Main grid: 2 columns */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: 2/3 width */}
          <div className="lg:col-span-2 space-y-6">
            {/* Platform breakdown */}
            <DashboardCard title="Vacatures per platform" icon={<BarChart3 className="h-4 w-4" />}>
              <div className="space-y-3">
                {platformCounts.map((p) => {
                  const percentage = totalJobs > 0 ? Math.round((p.count / totalJobs) * 100) : 0;
                  return (
                    <div key={p.platform} className="flex items-center gap-3">
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
                    </div>
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
                <div className="divide-y divide-border">
                  {recentScrapes.map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between py-2.5 first:pt-0 last:pb-0"
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
                    </div>
                  ))}
                </div>
              )}
            </DashboardCard>
          </div>

          {/* Right: 1/3 width */}
          <div className="space-y-6">
            {/* Top companies */}
            <DashboardCard title="Top opdrachtgevers" icon={<Building2 className="h-4 w-4" />}>
              <div className="space-y-2.5">
                {topCompanies.map((c, i) => (
                  <div key={c.company} className="flex items-center justify-between">
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
                  </div>
                ))}
              </div>
            </DashboardCard>

            {/* Top locations */}
            <DashboardCard title="Top provincies" icon={<MapPin className="h-4 w-4" />}>
              <div className="space-y-2.5">
                {locationCounts.map((l, i) => (
                  <div key={l.province} className="flex items-center justify-between">
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
                  </div>
                ))}
              </div>
            </DashboardCard>

            {/* System status — derived from actual scrape results */}
            <DashboardCard title="Systeem status" icon={<Zap className="h-4 w-4" />}>
              <div className="space-y-3">
                <StatusRow label="Database" status="online" />
                {activeScrapers.map((s) => {
                  const lastRun = recentScrapes.find((r) => r.platform === s.platform);
                  const isHealthy = lastRun ? lastRun.status !== "failed" : false;
                  return (
                    <StatusRow
                      key={s.platform}
                      label={`${s.platform.charAt(0).toUpperCase()}${s.platform.slice(1)} scraper`}
                      status={isHealthy ? "online" : "offline"}
                    />
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
