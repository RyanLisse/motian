"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RunEvidenceJourney } from "@/src/autopilot/run-detail";

interface EvidenceViewerProps {
  evidence: RunEvidenceJourney[];
}

function getDefaultTab(journey: RunEvidenceJourney): string {
  if (journey.artifacts.some((artifact) => artifact.kind === "video")) return "video";
  if (journey.artifacts.some((artifact) => artifact.kind === "screenshot")) return "screenshots";
  if (journey.artifacts.some((artifact) => artifact.kind === "trace")) return "trace";
  if (journey.artifacts.some((artifact) => artifact.kind === "har")) return "network";
  return "video";
}

function buildTraceViewerHref(proxyPath: string): string {
  const traceUrl =
    typeof window === "undefined"
      ? proxyPath
      : new URL(proxyPath, window.location.origin).toString();
  return `https://trace.playwright.dev/?trace=${encodeURIComponent(traceUrl)}`;
}

export function EvidenceViewer({ evidence }: EvidenceViewerProps) {
  if (evidence.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card px-6 py-10 text-center">
        <h3 className="text-sm font-medium text-foreground">Geen bewijs beschikbaar</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Deze run heeft nog geen rijke bewijslast om te tonen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {evidence.map((journey) => {
        const video = journey.artifacts.find((artifact) => artifact.kind === "video");
        const screenshots = journey.artifacts.filter((artifact) => artifact.kind === "screenshot");
        const trace = journey.artifacts.find((artifact) => artifact.kind === "trace");
        const har = journey.artifacts.find((artifact) => artifact.kind === "har");

        return (
          <section key={journey.journeyId} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">{journey.journeyId}</h3>
                <p className="text-sm text-muted-foreground">{journey.surface}</p>
                {journey.failureReason ? (
                  <p className="mt-2 text-sm text-muted-foreground">{journey.failureReason}</p>
                ) : null}
              </div>

              <Badge variant={journey.success ? "outline" : "destructive"}>
                {journey.success ? "Geslaagd" : "Mislukt"}
              </Badge>
            </div>

            <Tabs defaultValue={getDefaultTab(journey)} className="mt-4 w-full">
              <TabsList>
                <TabsTrigger value="video">Video</TabsTrigger>
                <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
                <TabsTrigger value="trace">Trace</TabsTrigger>
                <TabsTrigger value="network">Netwerk</TabsTrigger>
              </TabsList>

              <TabsContent value="video" className="pt-4">
                {video ? (
                  <div className="space-y-3">
                    <video
                      controls
                      muted
                      preload="metadata"
                      className="w-full rounded-lg border border-border"
                    >
                      <source src={video.proxyPath} type="video/webm" />
                    </video>
                    <a
                      href={video.proxyPath}
                      className="text-sm text-primary hover:underline"
                      download={video.filename}
                    >
                      Download video
                    </a>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Geen video beschikbaar</p>
                )}
              </TabsContent>

              <TabsContent value="screenshots" className="pt-4">
                {screenshots.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {screenshots.map((artifact) => (
                      <a
                        key={artifact.id}
                        href={artifact.proxyPath}
                        className="overflow-hidden rounded-lg border border-border"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Image
                          src={artifact.proxyPath}
                          alt={`${journey.journeyId} screenshot`}
                          className="h-full w-full object-cover"
                          width={1280}
                          height={720}
                          unoptimized
                        />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Geen screenshots beschikbaar</p>
                )}
              </TabsContent>

              <TabsContent value="trace" className="pt-4">
                {trace ? (
                  <div className="space-y-3">
                    <a
                      href={buildTraceViewerHref(trace.proxyPath)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      Open in Playwright Trace Viewer
                    </a>
                    <a
                      href={trace.proxyPath}
                      download={trace.filename}
                      className="block text-sm text-primary hover:underline"
                    >
                      Download trace
                    </a>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Geen trace beschikbaar</p>
                )}
              </TabsContent>

              <TabsContent value="network" className="pt-4">
                {har ? (
                  <a
                    href={har.proxyPath}
                    download={har.filename}
                    className="text-sm text-primary hover:underline"
                  >
                    Download HAR-bestand
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">Geen HAR-bestand beschikbaar</p>
                )}
              </TabsContent>
            </Tabs>
          </section>
        );
      })}
    </div>
  );
}
