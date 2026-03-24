import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  Clock,
  Database,
  Layers3,
  Search,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { CrossPlatformListings } from "@/components/scraper/cross-platform-listings";
import { formatPlatformLabel, PlatformBadge } from "@/components/scraper/platform-badge";
import { PlatformCatalogList } from "@/components/scraper/platform-catalog-list";
import { RecentActivityFeed } from "@/components/scraper/recent-activity-feed";
import { ScrapeMetricsExplainer } from "@/components/scraper/scrape-metrics-explainer";
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
import { cn } from "@/lib/utils";
import {
  getScraperDashboardData,
  type PlatformOperationalMetrics,
} from "@/src/services/scraper-dashboard";
import { listPlatformCatalog } from "@/src/services/scrapers";
import { ScraperActions } from "./actions";

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function signalToneClass(level: "info" | "warning" | "critical") {
  if (level === "critical") {
    return "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400";
  }

  if (level === "warning") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }

  return "border-border bg-muted text-muted-foreground";
}

function triggerStatusConfig(status: string | null) {
  const normalized = status?.toLowerCase() ?? "";

  if (["completed", "success", "succeeded"].includes(normalized)) {
    return {
      label: "Voltooid",
      className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    };
  }

  if (["failed", "errored", "canceled", "cancelled"].includes(normalized)) {
    return {
      label: "Mislukt",
      className: "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
    };
  }

  if (["executing", "pending", "queued", "running"].includes(normalized)) {
    return {
      label: normalized === "running" || normalized === "executing" ? "Bezig" : "In wachtrij",
      className: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    };
  }

  return {
    label: status ?? "onbekend",
    className: "border-border bg-muted text-muted-foreground",
  };
}

function PlatformHealthCard({
  platform,
  overlapCount,
}: {
  platform: PlatformOperationalMetrics;
  overlapCount: number;
}) {
  const latestSignals = platform.signals.slice(0, 2);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <PlatformBadge platform={platform.platform} />
              <CardTitle className="text-base">{formatPlatformLabel(platform.platform)}</CardTitle>
              {platform.circuitBreakerOpen && (
                <Badge
                  variant="outline"
                  className="border-red-500/20 bg-red-500/10 text-[10px] text-red-500"
                >
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  Circuit geopend
                </Badge>
              )}
            </div>
            {platform.baseUrl ? (
              <Link
                href={platform.baseUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                {platform.baseUrl}
              </Link>
            ) : (
              <p className="text-xs text-muted-foreground">Geen bron-URL opgeslagen</p>
            )}
          </div>
          <StatusBadge status={platform.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Slagingspercentage over alle runs</span>
            <span
              className={cn(
                platform.lifetime.successRate >= 80
                  ? "text-emerald-500"
                  : platform.lifetime.successRate >= 50
                    ? "text-amber-500"
                    : "text-red-500",
              )}
            >
              {platform.lifetime.successRate}%
            </span>
          </div>
          <Progress value={platform.lifetime.successRate} className="h-1.5" />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Laatste 24 uur: {platform.recent24h.runs} runs · {platform.recent24h.successRate}%
            succes
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
            <p className="text-lg font-bold text-foreground">{platform.lifetime.totalJobsNew}</p>
            <p className="text-[10px] text-muted-foreground">Nieuw opgeslagen</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
            <p className="text-lg font-bold text-foreground">{platform.lifetime.totalDuplicates}</p>
            <p className="text-[10px] text-muted-foreground">Bijgewerkt</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
            <p className="text-lg font-bold text-foreground">{platform.recent24h.failedCount}</p>
            <p className="text-[10px] text-muted-foreground">Mislukt in 24u</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
            <p className="text-lg font-bold text-foreground">{overlapCount}</p>
            <p className="text-[10px] text-muted-foreground">Overlapgroepen</p>
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between gap-3">
            <span>Schema</span>
            <span className="font-mono text-[10px]">{platform.cronExpression ?? "-"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Laatste run</span>
            <span>{formatDateTime(platform.lastRunAt)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Volgende run</span>
            <span>{formatDateTime(platform.nextRunAt)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Gem. duur</span>
            <span>
              {platform.lifetime.avgDurationMs > 0
                ? `${(platform.lifetime.avgDurationMs / 1000).toFixed(1)}s`
                : "-"}
            </span>
          </div>
        </div>

        {latestSignals.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {latestSignals.map((signal) => (
              <Badge
                key={`${platform.platform}-${signal.code}`}
                variant="outline"
                className={cn(
                  "max-w-full whitespace-normal text-left",
                  signalToneClass(signal.level),
                )}
                title={signal.message}
              >
                {signal.message}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Geen open waarschuwingen voor dit platform.
          </p>
        )}

        {platform.latestError && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <p className="font-medium">Laatste foutmelding</p>
            <p className="mt-1 wrap-break-word">{platform.latestError}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const revalidate = 60;

export default async function ScraperPage() {
  const scraperDashboard = await getScraperDashboardData({
    activityLimit: 20,
    overlapLimit: 8,
    includeTrigger: true,
  });
  const platformCatalog = await listPlatformCatalog();
  const {
    analytics,
    activeVacancies,
    recentRuns: results,
    platforms,
    activity,
    overlap,
    trigger,
  } = scraperDashboard;

  const attentionPlatforms = platforms.filter(
    (platform) => platform.status === "waarschuwing" || platform.status === "kritiek",
  ).length;
  const overlapCountByPlatform = new Map<string, number>();

  for (const group of overlap.groups) {
    for (const platform of group.platforms) {
      overlapCountByPlatform.set(platform, (overlapCountByPlatform.get(platform) ?? 0) + 1);
    }
  }

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto min-w-0 max-w-[1400px] space-y-6 px-4 py-6 md:px-6 lg:px-8">
        <PageHeader
          title="Scraper-dashboard"
          description="Volg databronnen, overlap tussen platforms en operationele gezondheid vanuit één overzicht"
        >
          <ScraperActions />
        </PageHeader>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KPICard
            icon={<Activity className="h-4 w-4" />}
            label="Totaal runs"
            value={analytics.totalRuns}
            iconClassName="text-primary/60"
            valueClassName="text-primary"
            compact
            title="Aantal scrape-runs in de historie over alle platforms"
          />
          <KPICard
            icon={<Search className="h-4 w-4" />}
            label="Actieve vacatures"
            value={activeVacancies}
            iconClassName="text-blue-500/60"
            valueClassName="text-blue-500"
            compact
            title="Huidig aantal zichtbare vacatures op de Vacatures-pagina (open en gededupliceerd)"
          />
          <KPICard
            icon={<Layers3 className="h-4 w-4" />}
            label="Overlapgroepen"
            value={overlap.totalGroups}
            iconClassName="text-violet-500/60"
            valueClassName="text-violet-500"
            compact
            title="Groepen waarin meerdere bronnen waarschijnlijk dezelfde opdracht tonen"
          />
          <KPICard
            icon={<Sparkles className="h-4 w-4" />}
            label="Nieuw toegevoegd"
            value={analytics.totalJobsNew}
            iconClassName="text-green-500/60"
            valueClassName="text-green-500"
            compact
            title="Cumulatief aantal nieuw opgeslagen vacatures over alle runs"
          />
          <KPICard
            icon={<Database className="h-4 w-4" />}
            label="Bijgewerkt"
            value={analytics.totalDuplicates}
            iconClassName="text-amber-500/60"
            valueClassName="text-amber-500"
            compact
            title="Listings die op dezelfde bron opnieuw zijn binnengekomen en een bestaande vacature hebben bijgewerkt"
          />
          <KPICard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Platforms met aandacht"
            value={attentionPlatforms}
            iconClassName={attentionPlatforms > 0 ? "text-amber-500/60" : "text-emerald-500/60"}
            valueClassName={attentionPlatforms > 0 ? "text-amber-500" : "text-emerald-500"}
            compact
            title="Platformen met waarschuwingen of kritieke health-signalen"
          />
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <ScrapeMetricsExplainer />
          <RecentActivityFeed activities={activity} />
        </div>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers3 className="h-4 w-4" />
              Platformcatalogus en inrichting
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Recruiters en agenten gebruiken hier dezelfde bouwstenen: kies een platform, sla de
              configuratie op, valideer de toegang en voer een proefimport uit.
            </p>
          </CardHeader>
          <CardContent>
            <PlatformCatalogList entries={platformCatalog} />
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
          <Card className="min-w-0 overflow-hidden bg-card border-border">
            <CardHeader className="min-w-0 pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                Planning per platform
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Laat zien welke bron wanneer weer hoort te draaien en waar operationele signalen al
                aandacht vragen.
              </p>
            </CardHeader>
            <CardContent className="min-w-0">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Platform</TableHead>
                    <TableHead>Schema</TableHead>
                    <TableHead>Laatste run</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Volgende run</TableHead>
                    <TableHead>Signaal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {platforms.map((platform) => (
                    <TableRow key={platform.platform} className="border-border">
                      <TableCell>
                        <PlatformBadge platform={platform.platform} className="text-[10px]" />
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {platform.cronExpression ?? "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(platform.lastRunAt)}
                      </TableCell>
                      <TableCell>
                        {platform.circuitBreakerOpen ? (
                          <Badge
                            variant="outline"
                            className="border-red-500/20 bg-red-500/10 text-[10px] text-red-500"
                          >
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Circuit geopend
                          </Badge>
                        ) : platform.isOverdue ? (
                          <Badge
                            variant="outline"
                            className="border-amber-500/20 bg-amber-500/10 text-[10px] text-amber-500"
                          >
                            <Clock className="mr-1 h-3 w-3" />
                            Achterstallig
                          </Badge>
                        ) : (
                          <StatusBadge status={platform.status} />
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(platform.nextRunAt)}
                      </TableCell>
                      <TableCell className="max-w-[320px] whitespace-normal">
                        <span className="wrap-break-word text-xs text-muted-foreground">
                          {platform.signals[0]?.message ?? "Geen open signaal"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden bg-card border-border">
            <CardHeader className="min-w-0 pb-3">
              <CardTitle className="text-base">Trigger.dev zichtbaarheid</CardTitle>
              <p className="text-sm text-muted-foreground">
                Laatste taakruns van de automatisering achter de databronnen-monitoring.
              </p>
            </CardHeader>
            <CardContent className="min-w-0 space-y-3">
              {!trigger.available && (
                <div className="wrap-break-word rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  Trigger.dev informatie is nu niet beschikbaar.
                  {trigger.reason ? ` Reden: ${trigger.reason}` : ""}
                </div>
              )}

              {trigger.tasks.map((task) => {
                const status = triggerStatusConfig(task.latestRun?.status ?? null);

                return (
                  <div
                    key={task.taskIdentifier}
                    className="min-w-0 rounded-xl border border-border bg-muted/20 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">{task.label}</p>
                        <p className="mt-1 wrap-break-word text-xs text-muted-foreground">
                          {task.cronExpression} · {task.timezone}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "max-w-full whitespace-normal wrap-break-word text-center",
                          status.className,
                        )}
                      >
                        {status.label}
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                      <p>Laatste run: {formatDateTime(task.latestRun?.createdAt ?? null)}</p>
                      {task.latestRun?.error && (
                        <p className="wrap-break-word text-amber-600 dark:text-amber-400">
                          {task.latestRun.error}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {platforms.length > 0 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Per-platform gezondheid</h2>
              <p className="text-sm text-muted-foreground">
                Historische statistieken, recente fouten en planningssignalen per bron in één kaart.
              </p>
            </div>

            <div className="grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {platforms.map((platform) => (
                <PlatformHealthCard
                  key={platform.platform}
                  platform={platform}
                  overlapCount={overlapCountByPlatform.get(platform.platform) ?? 0}
                />
              ))}
            </div>
          </div>
        )}

        <CrossPlatformListings groups={overlap.groups} />

        {/* Overzicht van alle scrape-runs */}
        <Card className="bg-card border-border min-w-0">
          <CardHeader>
            <CardTitle className="text-base">Overzicht scrape-runs</CardTitle>
            <p className="text-sm text-muted-foreground">
              Alle recente scrapes. Hier zie je expliciet het verschil tussen nieuw, bijgewerkt
              (zelfde bron) en overgeslagen, plus een link naar de run-details.
            </p>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
                <p className="text-sm font-medium text-muted-foreground">
                  Nog geen scrape-resultaten
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Start een scrape via de knop hierboven of wacht op de geplande run. Resultaten
                  verschijnen hier zodra er runs zijn uitgevoerd.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead>Bron / platform</TableHead>
                      <TableHead>Datum en tijd</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right" title="Aantal gevonden items bij de bron">
                        Gevonden
                      </TableHead>
                      <TableHead className="text-right" title="Nieuw opgeslagen in de database">
                        Nieuw
                      </TableHead>
                      <TableHead
                        className="text-right"
                        title="Bestaande vacature bijgewerkt op dezelfde bron"
                      >
                        Bijgewerkt
                      </TableHead>
                      <TableHead className="text-right" title="Validatiefout of niet opgeslagen">
                        Overgeslagen
                      </TableHead>
                      <TableHead className="text-right">Duur</TableHead>
                      <TableHead>Fouten / waarschuwingen</TableHead>
                      <TableHead className="w-[100px]">Actie</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result) => {
                      const errors = Array.isArray(result.errors)
                        ? (result.errors as string[])
                        : [];

                      return (
                        <TableRow
                          key={result.id}
                          className="border-border hover:bg-muted/50 transition-colors"
                        >
                          <TableCell className="font-medium">
                            <PlatformBadge platform={result.platform} className="text-[10px]" />
                          </TableCell>
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {result.runAt
                              ? new Date(result.runAt).toLocaleString("nl-NL", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
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
                          <TableCell>
                            <Link
                              href={`/scraper/runs/${result.id}`}
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                              Bekijk details
                              <ChevronRight className="h-3 w-3" />
                            </Link>
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
