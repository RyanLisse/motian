import { AlertCircle, ArrowRight, Clock4 } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScraperActivityItem } from "@/src/services/scraper-dashboard";
import { PlatformBadge } from "./platform-badge";

function formatActivityDate(value: Date | null) {
  if (!value) return "Onbekend tijdstip";

  return value.toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RecentActivityFeed({ activities }: { activities: ScraperActivityItem[] }) {
  return (
    <Card className="bg-card border-border min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock4 className="h-4 w-4 text-muted-foreground" />
          Recente activiteit en logs
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          De nieuwste runs met status, aantallen en de laatste fout- of waarschuwingsmelding.
        </p>
      </CardHeader>
      <CardContent className="min-w-0">
        {activities.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-8 text-sm text-muted-foreground">
            Nog geen activiteit zichtbaar.
          </div>
        ) : (
          <div className="max-h-[420px] min-w-0 overflow-y-auto pr-4">
            <div className="min-w-0 space-y-3">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="min-w-0 rounded-xl border border-border bg-muted/20 p-4"
                >
                  <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <PlatformBadge platform={activity.platform} className="text-[10px]" />
                        <StatusBadge status={activity.status} className="text-[10px]" />
                        <span className="text-xs text-muted-foreground">
                          {formatActivityDate(activity.occurredAt)}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">{activity.title}</p>
                        <p className="text-xs text-muted-foreground">{activity.message}</p>
                      </div>
                      <p className="text-sm text-foreground">
                        {activity.jobsFound} gevonden · {activity.jobsNew} nieuw ·{" "}
                        {activity.duplicates} bijgewerkt
                        {activity.skipped > 0 ? ` · ${activity.skipped} overgeslagen` : ""}
                        {activity.durationMs
                          ? ` · ${(activity.durationMs / 1000).toFixed(1)}s`
                          : ""}
                      </p>
                      {activity.errors.length > 0 && (
                        <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                          <span className="flex items-center gap-1 font-medium">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Laatste melding
                          </span>
                          <p className="mt-1 break-words">{activity.errors[0]}</p>
                          {activity.errors.length > 1 && (
                            <p className="mt-1 text-amber-600/80 dark:text-amber-400/80">
                              +{activity.errors.length - 1} extra melding(en)
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <Link
                      href={activity.href}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Run-details
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
