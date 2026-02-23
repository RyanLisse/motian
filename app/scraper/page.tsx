import { desc } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ScraperActions } from "./actions";

export const dynamic = "force-dynamic";

export default async function ScraperPage() {
  const [configs, results] = await Promise.all([
    db.select().from(scraperConfigs).orderBy(scraperConfigs.platform),
    db.select().from(scrapeResults).orderBy(desc(scrapeResults.runAt)).limit(20),
  ]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <PageHeader
          title="Scraper Dashboard"
          description="Beheer scraper configuraties en bekijk resultaten"
        >
          <ScraperActions />
        </PageHeader>

        {/* Configs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {configs.map((config) => (
            <Card key={config.id} className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base capitalize">{config.platform}</CardTitle>
                  <StatusBadge
                    status={
                      !config.isActive
                        ? "inactief"
                        : (config.consecutiveFailures ?? 0) > 3
                          ? "kritiek"
                          : (config.consecutiveFailures ?? 0) > 0
                            ? "waarschuwing"
                            : "gezond"
                    }
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>
                    URL:{" "}
                    <span className="font-mono text-xs text-foreground truncate block">
                      {config.baseUrl}
                    </span>
                  </p>
                  {config.lastRunAt && (
                    <p>
                      Laatste run:{" "}
                      <span className="text-foreground">
                        {new Date(config.lastRunAt).toLocaleString("nl-NL", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </p>
                  )}
                  {config.lastRunStatus && (
                    <p>
                      Status: <StatusBadge status={config.lastRunStatus} />
                    </p>
                  )}
                  {(config.consecutiveFailures ?? 0) > 0 && (
                    <p
                      className={
                        (config.consecutiveFailures ?? 0) >= 5
                          ? "text-red-500 font-medium"
                          : "text-yellow-400"
                      }
                    >
                      {(config.consecutiveFailures ?? 0) >= 5
                        ? `Circuit breaker OPEN — ${config.consecutiveFailures} fouten`
                        : `Circuit breaker: ${config.consecutiveFailures} opeenvolgende fouten`}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    Cron: {config.cronExpression}
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      config.isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {config.isActive ? "Actief" : "Inactief"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* History */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">Recente Scrape Resultaten</CardTitle>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nog geen resultaten</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Platform</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Gevonden</TableHead>
                    <TableHead className="text-right">Nieuw</TableHead>
                    <TableHead className="text-right">Duplicaten</TableHead>
                    <TableHead className="text-right">Duur</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((result) => (
                    <TableRow key={result.id} className="border-border">
                      <TableCell className="capitalize font-medium">{result.platform}</TableCell>
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
                      <TableCell className="text-right text-primary">{result.jobsNew}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {result.duplicates}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {result.durationMs ? `${(result.durationMs / 1000).toFixed(1)}s` : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
