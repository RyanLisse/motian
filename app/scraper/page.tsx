import { desc } from "drizzle-orm";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CalendarClock,
  CheckCircle,
  Clock,
  Database,
  Search,
  Sparkles,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AnalyticsCharts } from "@/components/scraper/analytics-charts";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/src/db";
import { scrapeResults, scraperConfigs } from "@/src/db/schema";
import { getAnalytics } from "@/src/services/scrape-results";
import { ScraperActions } from "./actions";

/** Parse a simple cron hour interval (e.g. `0 *​/4 * * *`) to milliseconds. */
function cronIntervalMs(cron: string): number | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [min, hour] = parts;
  const hourMatch = hour.match(/^\*\/(\d+)$/);
  if (hourMatch && min === "0") return Number.parseInt(hourMatch[1], 10) * 3_600_000;
  return null;
}

function getNextRunAt(config: {
  lastRunAt: Date | null;
  cronExpression: string | null;
}): Date | null {
  if (!config.lastRunAt || !config.cronExpression) return null;
  const interval = cronIntervalMs(config.cronExpression);
  if (!interval) return null;
  return new Date(new Date(config.lastRunAt).getTime() + interval);
}

function isDue(config: { lastRunAt: Date | null; cronExpression: string | null }): boolean {
  const next = getNextRunAt(config);
  if (!next) return false;
  return next.getTime() <= Date.now();
}

export const dynamic = "force-dynamic";

export default async function ScraperPage() {
  const [configs, results, analytics] = await Promise.all([
    db.select().from(scraperConfigs).orderBy(scraperConfigs.platform),
    db.select().from(scrapeResults).orderBy(desc(scrapeResults.runAt)).limit(30),
    getAnalytics(),
  ]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <PageHeader
          title="Scraper-dashboard"
          description="Beheer scraper configuraties en bekijk resultaten"
        >
          <ScraperActions />
        </PageHeader>

        {/* KPI Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPICard
            icon={<Activity className="h-4 w-4" />}
            label="Totaal Runs"
            value={analytics.totalRuns}
            iconClassName="text-primary/60"
            valueClassName="text-primary"
            compact
            title="Aantal scrape-runs in de historie (alle platforms)"
          />
          <KPICard
            icon={<Search className="h-4 w-4" />}
            label="Actieve Vacatures"
            value={analytics.totalUniqueJobs}
            iconClassName="text-blue-500/60"
            valueClassName="text-blue-500"
            compact
            title="Huidig aantal opdrachten in de database (niet verwijderd)"
          />
          <KPICard
            icon={<Sparkles className="h-4 w-4" />}
            label="Nieuw Toegevoegd"
            value={analytics.totalJobsNew}
            iconClassName="text-green-500/60"
            valueClassName="text-green-500"
            compact
            title="Cumulatief aantal inserts (nieuw) over alle runs"
          />
          <KPICard
            icon={<Database className="h-4 w-4" />}
            label="Verwerkt per run"
            value={
              analytics.totalRuns > 0
                ? Math.round(
                    (analytics.totalJobsNew + analytics.totalDuplicates) / analytics.totalRuns,
                  )
                : 0
            }
            iconClassName="text-amber-500/60"
            valueClassName="text-amber-500"
            compact
            title="Gemiddeld aantal opgeslagen per run (nieuw + duplicaten)"
          />
          <KPICard
            icon={<CheckCircle className="h-4 w-4" />}
            label="Slagingspercentage"
            value={`${analytics.overallSuccessRate}%`}
            iconClassName="text-emerald-500/60"
            valueClassName={
              analytics.overallSuccessRate >= 80
                ? "text-emerald-500"
                : analytics.overallSuccessRate >= 50
                  ? "text-amber-500"
                  : "text-red-500"
            }
            compact
            title="Percentage runs met status geslaagd of gedeeltelijk"
          />
          <KPICard
            icon={<Clock className="h-4 w-4" />}
            label="Gem. Duur"
            value={
              analytics.avgDurationMs > 0 ? `${(analytics.avgDurationMs / 1000).toFixed(1)}s` : "-"
            }
            iconClassName="text-muted-foreground"
            compact
            title="Gemiddelde duur van een scrape-run (alle platforms)"
          />
        </div>

        {/* Time-series charts (client component) */}
        <AnalyticsCharts />

        {/* Trigger.dev Taakstatus */}
        {configs.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                Trigger.dev Taakstatus
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead>Platform</TableHead>
                      <TableHead>Schema</TableHead>
                      <TableHead>Laatste Run</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Volgende Run</TableHead>
                      <TableHead className="text-right">Fouten</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {configs.map((config) => {
                      const nextRun = getNextRunAt(config);
                      const due = isDue(config);
                      const circuitOpen = (config.consecutiveFailures ?? 0) >= 5;

                      return (
                        <TableRow key={config.id} className="border-border">
                          <TableCell className="capitalize font-medium">
                            {config.platform}
                          </TableCell>
                          <TableCell className="text-muted-foreground font-mono text-xs">
                            {config.cronExpression ?? "-"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {config.lastRunAt
                              ? new Date(config.lastRunAt).toLocaleString("nl-NL", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  timeZone: "Europe/Amsterdam",
                                })
                              : "Nooit"}
                          </TableCell>
                          <TableCell>
                            {circuitOpen ? (
                              <Badge
                                variant="outline"
                                className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px]"
                              >
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Circuit Open
                              </Badge>
                            ) : due ? (
                              <Badge
                                variant="outline"
                                className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px]"
                              >
                                <Clock className="h-3 w-3 mr-1" />
                                Achterstallig
                              </Badge>
                            ) : config.lastRunStatus ? (
                              <StatusBadge status={config.lastRunStatus} />
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {nextRun
                              ? nextRun.toLocaleString("nl-NL", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  timeZone: "Europe/Amsterdam",
                                })
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {(config.consecutiveFailures ?? 0) > 0 ? (
                              <span className="text-red-500 font-medium">
                                {config.consecutiveFailures}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Per-Platform Analytics */}
        {analytics.byPlatform.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {analytics.byPlatform.map((p) => {
              const config = configs.find((c) => c.platform === p.platform);
              const circuitOpen = (config?.consecutiveFailures ?? 0) >= 5;

              return (
                <Card key={p.platform} className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base capitalize flex items-center gap-2">
                        {p.platform}
                        {circuitOpen && (
                          <Badge
                            variant="outline"
                            className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px]"
                          >
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Circuit Open
                          </Badge>
                        )}
                      </CardTitle>
                      <StatusBadge
                        status={
                          !config?.isActive
                            ? "inactief"
                            : circuitOpen
                              ? "kritiek"
                              : (config?.consecutiveFailures ?? 0) > 0
                                ? "waarschuwing"
                                : "gezond"
                        }
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Success rate bar */}
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Slagingspercentage</span>
                        <span
                          className={
                            p.successRate >= 80
                              ? "text-emerald-500"
                              : p.successRate >= 50
                                ? "text-amber-500"
                                : "text-red-500"
                          }
                        >
                          {p.successRate}%
                        </span>
                      </div>
                      <Progress value={p.successRate} className="h-1.5" />
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold text-foreground">{p.totalJobsNew}</p>
                        <p className="text-[10px] text-muted-foreground">Nieuw</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-foreground">{p.totalJobsFound}</p>
                        <p className="text-[10px] text-muted-foreground">Gevonden</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-foreground">{p.totalRuns}</p>
                        <p className="text-[10px] text-muted-foreground">Runs</p>
                      </div>
                    </div>

                    {/* Run breakdown */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border">
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-emerald-500" />
                        {p.successCount}
                      </span>
                      {p.partialCount > 0 && (
                        <span className="flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 text-amber-500" />
                          {p.partialCount}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <XCircle className="h-3 w-3 text-red-500" />
                        {p.failedCount}
                      </span>
                      <span className="ml-auto">
                        Gem. {p.avgDurationMs > 0 ? `${(p.avgDurationMs / 1000).toFixed(1)}s` : "-"}
                      </span>
                    </div>

                    {/* Config info */}
                    {config && (
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p className="font-mono text-[10px] truncate">{config.baseUrl}</p>
                        {config.lastRunAt && (
                          <p>
                            Laatste:{" "}
                            {new Date(config.lastRunAt).toLocaleString("nl-NL", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Configs without analytics data (newly added scrapers) */}
        {configs.filter((c) => !analytics.byPlatform.some((p) => p.platform === c.platform))
          .length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {configs
              .filter((c) => !analytics.byPlatform.some((p) => p.platform === c.platform))
              .map((config) => (
                <Card key={config.id} className="bg-card border-border opacity-60">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base capitalize">{config.platform}</CardTitle>
                      <StatusBadge status={config.isActive ? "gezond" : "inactief"} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Nog geen scrape data beschikbaar
                    </p>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}

        {/* History Table */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">Recente Scrape Resultaten</CardTitle>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nog geen resultaten</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead>Platform</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Gevonden</TableHead>
                      <TableHead className="text-right">Nieuw</TableHead>
                      <TableHead className="text-right">Duplicaten</TableHead>
                      <TableHead className="text-right" title="Validatiefout of niet opgeslagen">
                        Overgeslagen
                      </TableHead>
                      <TableHead className="text-right">Duur</TableHead>
                      <TableHead>Fouten</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result) => {
                      const errors = Array.isArray(result.errors)
                        ? (result.errors as string[])
                        : [];

                      return (
                        <TableRow key={result.id} className="border-border">
                          <TableCell className="capitalize font-medium">
                            {result.platform}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {result.runAt
                              ? new Date(result.runAt).toLocaleString("nl-NL", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={result.status} />
                          </TableCell>
                          <TableCell className="text-right">{result.jobsFound}</TableCell>
                          <TableCell className="text-right text-primary">
                            {result.jobsNew}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {result.duplicates}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {(() => {
                              const skipped =
                                (result.jobsFound ?? 0) -
                                (result.jobsNew ?? 0) -
                                (result.duplicates ?? 0);
                              return skipped > 0 ? skipped : "-";
                            })()}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {result.durationMs ? `${(result.durationMs / 1000).toFixed(1)}s` : "-"}
                          </TableCell>
                          <TableCell>
                            {errors.length > 0 ? (
                              <span
                                className="flex items-center gap-1 text-xs text-amber-500 cursor-help max-w-[200px]"
                                title={errors.join("\n")}
                              >
                                <AlertCircle className="h-3 w-3 shrink-0" />
                                <span className="truncate">
                                  {errors.length === 1 ? errors[0] : `${errors.length} fouten`}
                                </span>
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
