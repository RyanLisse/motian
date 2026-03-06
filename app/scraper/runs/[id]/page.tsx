import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  CheckCircle,
  Clock,
  FileJson,
  Search,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { RunDetailJobs } from "@/components/scraper/run-detail-jobs";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getJobsForRun, getRunById } from "@/src/services/scrape-results";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function ScraperRunDetailPage({ params }: PageProps) {
  const { id } = await params;
  const run = await getRunById(id);
  if (!run) notFound();

  const jobIds = Array.isArray(run.jobIds) ? (run.jobIds as string[]) : null;
  const jobs = await getJobsForRun(jobIds, { includeRawPayload: false });

  const errors = Array.isArray(run.errors) ? (run.errors as string[]) : [];
  const skipped = (run.jobsFound ?? 0) - (run.jobsNew ?? 0) - (run.duplicates ?? 0);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <PageHeader
          title={`Scrape-run: ${run.platform}`}
          description={`Run van ${run.runAt ? new Date(run.runAt).toLocaleString("nl-NL", { dateStyle: "long", timeStyle: "short" }) : "onbekend"}`}
        >
          <Link
            href="/scraper"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Terug naar overzicht
          </Link>
        </PageHeader>

        {/* Run-samenvatting */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              Gegevens van deze run
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Bron / platform</p>
                <p className="font-medium capitalize">{run.platform}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Datum en tijd</p>
                <p className="font-medium">
                  {run.runAt
                    ? new Date(run.runAt).toLocaleString("nl-NL", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Status</p>
                <StatusBadge status={run.status} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Duur</p>
                <p className="font-medium">
                  {run.durationMs != null ? `${(run.durationMs / 1000).toFixed(1)}s` : "-"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Gevonden</p>
                  <p className="font-semibold">{run.jobsFound ?? 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Nieuw</p>
                  <p className="font-semibold text-green-600 dark:text-green-400">
                    {run.jobsNew ?? 0}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Bijgewerkt</p>
                  <p className="font-semibold">{run.duplicates ?? 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-amber-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Overgeslagen</p>
                  <p className="font-semibold">{skipped > 0 ? skipped : 0}</p>
                </div>
              </div>
            </div>

            {errors.length > 0 && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Fouten of waarschuwingen
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-0.5">
                  {errors.map((err, i) => (
                    <li key={`error-${i}-${err.slice(0, 30)}`}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gescrapede records */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileJson className="h-4 w-4 text-muted-foreground" />
              Gescrapede records
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Vacatures uit deze run. Klik op &quot;Bekijk JSON&quot; voor de ruwe gescrapede data
              per opdracht.
            </p>
          </CardHeader>
          <CardContent>
            <RunDetailJobs
              jobs={jobs}
              emptyMessage="Geen vacaturekoppeling beschikbaar voor deze run. Oudere runs slaan geen job-ids op."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
