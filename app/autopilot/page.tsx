import { Activity, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAutopilotDashboardData } from "./data";
import { getAutopilotStatusPresentation, getStatusBadge } from "./shared";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export const dynamic = "force-dynamic";

function AutopilotSkeleton() {
  return (
    <div className="flex-1 flex flex-col bg-background p-6">
      <div className="max-w-7xl w-full mx-auto space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  );
}

async function AutopilotContent() {
  const { runs, loadError } = await getAutopilotDashboardData();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-6 lg:px-8">
        <PageHeader
          title="Autopilot"
          description="Nachtelijke audit resultaten van product surfaces"
          breadcrumbs={[
            { label: "Overzicht", href: "/overzicht" },
            { label: "Automatisering", href: "/automatisering" },
            { label: "Autopilot", href: "/autopilot" },
          ]}
        >
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/automatisering">Terug naar Automatisering</Link>
          </Button>
        </PageHeader>

        {loadError && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">Autopilot laadt gedeeltelijk in gedegradeerde modus.</p>
              <p className="text-amber-700/80 dark:text-amber-300/80">
                De meest recente runs of bevindingen konden niet volledig worden opgehaald (
                {loadError}).
              </p>
            </div>
          </div>
        )}

        {/* Run History Table */}
        {runs.length === 0 ? (
          <div className="flex items-center justify-center py-16 bg-card border border-border rounded-lg">
            <div className="text-center max-w-sm px-6">
              <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center mx-auto mb-5">
                <Activity className="h-7 w-7 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2">
                {loadError ? "Autopilot tijdelijk niet beschikbaar" : "Geen runs gevonden"}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {loadError
                  ? "De runhistorie kon nu niet worden opgehaald. Probeer het zo opnieuw of controleer de database- en blobverbinding."
                  : "Er zijn nog geen autopilot runs uitgevoerd"}
              </p>
            </div>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Gestart</TableHead>
                  <TableHead>Commit</TableHead>
                  <TableHead className="text-right">Journeys</TableHead>
                  <TableHead className="text-right">Bevindingen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => {
                  const statusPresentation = getAutopilotStatusPresentation(run);

                  return (
                    <TableRow key={run.id}>
                      <TableCell>
                        <Link
                          href={`/autopilot/${run.runId}`}
                          className="font-mono text-sm text-primary hover:underline"
                        >
                          {run.runId.slice(0, 12)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {getStatusBadge(statusPresentation.badgeStatus)}
                          {statusPresentation.note && (
                            <p className="text-xs text-muted-foreground">
                              {statusPresentation.note}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(run.startedAt)}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-0.5 rounded">
                          {run.commitSha.slice(0, 7)}
                        </code>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm">
                          <span className="text-green-600 font-medium">{run.passedJourneys}</span>
                          <span className="text-muted-foreground mx-1">/</span>
                          <span className="text-muted-foreground">{run.totalJourneys}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-medium">
                          {run.totalFindings > 0 ? (
                            <span className="text-orange-600">{run.totalFindings}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AutopilotPage() {
  return (
    <Suspense fallback={<AutopilotSkeleton />}>
      <AutopilotContent />
    </Suspense>
  );
}
