import { Activity, AlertCircle, CheckCircle2, ExternalLink, XCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EvidenceViewer } from "@/components/autopilot/evidence-viewer";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getRunDetail } from "../data";

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <Badge variant="outline" className="border-green-500 text-green-700">
          <CheckCircle2 className="h-3 w-3" />
          Voltooid
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3" />
          Mislukt
        </Badge>
      );
    case "running":
      return (
        <Badge variant="secondary">
          <Activity className="h-3 w-3" />
          Actief
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getSeverityBadge(severity: string) {
  switch (severity) {
    case "critical":
      return <Badge variant="destructive">Kritiek</Badge>;
    case "high":
      return <Badge className="bg-orange-500 hover:bg-orange-600">Hoog</Badge>;
    case "medium":
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">Gemiddeld</Badge>;
    case "low":
      return <Badge variant="outline">Laag</Badge>;
    default:
      return <Badge variant="outline">{severity}</Badge>;
  }
}

function getCategoryBadge(category: string) {
  switch (category) {
    case "bug":
      return <Badge variant="destructive">Bug</Badge>;
    case "ux":
      return <Badge className="bg-blue-500 hover:bg-blue-600">UX</Badge>;
    case "perf":
      return <Badge className="bg-purple-500 hover:bg-purple-600">Performance</Badge>;
    case "ai-quality":
      return <Badge className="bg-green-500 hover:bg-green-600">AI Kwaliteit</Badge>;
    default:
      return <Badge variant="secondary">{category}</Badge>;
  }
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

type RunDetailProps = { params: Promise<{ runId: string }> };

function AutopilotRunDetailSkeleton() {
  return (
    <div className="flex-1 flex flex-col bg-background p-6">
      <div className="max-w-7xl w-full mx-auto space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  );
}

async function AutopilotRunDetailContent({ params }: RunDetailProps) {
  const { runId } = await params;
  const data = await getRunDetail(runId);

  if (!data) {
    notFound();
  }

  const { run, findings, evidence } = data;
  const duration = run.completedAt
    ? Math.round((run.completedAt.getTime() - run.startedAt.getTime()) / 1000)
    : null;

  return (
    <div className="flex-1 flex flex-col bg-background p-6">
      <div className="max-w-7xl w-full mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href="/autopilot"
                className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
              >
                ← Terug naar overzicht
              </Link>
              <h1 className="text-2xl font-semibold text-foreground">
                Run {run.runId.slice(0, 12)}
              </h1>
            </div>
            {getStatusBadge(run.status)}
          </div>

          {/* Run Metadata */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-xs text-muted-foreground mb-1">Gestart</div>
              <div className="text-sm font-medium">{formatDate(run.startedAt)}</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-xs text-muted-foreground mb-1">Commit</div>
              <div className="text-sm font-mono">{run.commitSha.slice(0, 7)}</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-xs text-muted-foreground mb-1">Journeys</div>
              <div className="text-sm font-medium">
                <span className="text-green-600">{run.passedJourneys}</span>
                <span className="text-muted-foreground mx-1">/</span>
                <span>{run.totalJourneys}</span>
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-xs text-muted-foreground mb-1">Bevindingen</div>
              <div className="text-sm font-medium">
                {run.totalFindings > 0 ? (
                  <span className="text-orange-600">{run.totalFindings}</span>
                ) : (
                  <span className="text-green-600">0</span>
                )}
              </div>
            </div>
          </div>

          {duration && (
            <div className="text-sm text-muted-foreground">
              Duur: {Math.floor(duration / 60)}m {duration % 60}s
            </div>
          )}

          {run.reportUrl && (
            <div>
              <Link
                href={run.reportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                Volledig rapport bekijken
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>

        {/* Findings Table */}
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Bevindingen</h2>

          {findings.length === 0 ? (
            <div className="flex items-center justify-center py-12 bg-card border border-border rounded-lg">
              <div className="text-center max-w-sm px-6">
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <p className="text-sm text-muted-foreground">Geen bevindingen in deze run</p>
              </div>
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titel</TableHead>
                    <TableHead>Surface</TableHead>
                    <TableHead>Categorie</TableHead>
                    <TableHead>Ernst</TableHead>
                    <TableHead>Vertrouwen</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>GitHub</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {findings.map((finding) => (
                    <TableRow key={finding.id}>
                      <TableCell>
                        <div className="max-w-md">
                          <div className="font-medium text-sm">{finding.title}</div>
                          <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {finding.description}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-0.5 rounded">
                          {finding.surface}
                        </code>
                      </TableCell>
                      <TableCell>{getCategoryBadge(finding.category)}</TableCell>
                      <TableCell>{getSeverityBadge(finding.severity)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <div className="text-sm">{Math.round(finding.confidence * 100)}%</div>
                          {finding.confidence >= 0.8 && (
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                          )}
                          {finding.confidence < 0.6 && (
                            <AlertCircle className="h-3 w-3 text-yellow-600" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={finding.status === "dismissed" ? "outline" : "secondary"}>
                          {finding.status === "detected" && "Gedetecteerd"}
                          {finding.status === "validated" && "Gevalideerd"}
                          {finding.status === "reported" && "Gerapporteerd"}
                          {finding.status === "dismissed" && "Afgewezen"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {finding.githubIssueNumber ? (
                          <Link
                            href={`https://github.com/RyanLisse/motian/issues/${finding.githubIssueNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1 text-sm"
                          >
                            #{finding.githubIssueNumber}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Bewijs</h2>
          <EvidenceViewer evidence={evidence} />
        </div>
      </div>
    </div>
  );
}

export default function AutopilotRunDetailPage(props: RunDetailProps) {
  return (
    <Suspense fallback={<AutopilotRunDetailSkeleton />}>
      <AutopilotRunDetailContent {...props} />
    </Suspense>
  );
}
