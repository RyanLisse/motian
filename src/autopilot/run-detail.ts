import { basename } from "node:path";
import { downloadFile } from "@/src/lib/file-storage";
import type { AutopilotEvidence, AutopilotRunSummary, EvidenceManifest } from "./types";

export interface RunEvidenceArtifact extends AutopilotEvidence {
  filename: string;
  proxyPath: string;
}

export interface RunEvidenceJourney {
  journeyId: string;
  surface: string;
  success: boolean;
  failureReason?: string;
  artifacts: RunEvidenceArtifact[];
}

export function deriveSummaryUrl(reportUrl: string): string {
  return replaceBlobFilename(reportUrl, "summary.json");
}

export function buildArtifactProxyPath(
  runId: string,
  journeyId: string,
  artifactId: string,
): string {
  return `/api/autopilot/runs/${encodeURIComponent(runId)}/evidence/${encodeURIComponent(journeyId)}/${encodeURIComponent(artifactId)}`;
}

export function buildEvidenceFromSummary(
  summary: AutopilotRunSummary,
  runId: string,
): RunEvidenceJourney[] {
  const resultByJourney = new Map(
    summary.journeyResults.map((result) => [result.journeyId, result]),
  );

  return summary.evidenceManifests.map((manifest) => {
    const journeyResult = resultByJourney.get(manifest.journeyId);

    return {
      journeyId: manifest.journeyId,
      surface: manifest.surface,
      success: journeyResult?.success ?? manifest.success,
      failureReason: manifest.failureReason,
      artifacts: manifest.artifacts.map((artifact) => ({
        ...artifact,
        filename: basename(artifact.path),
        proxyPath: buildArtifactProxyPath(runId, manifest.journeyId, artifact.id),
      })),
    };
  });
}

export async function loadRunSummaryFromReportUrl(
  reportUrl: string,
): Promise<{ summary: AutopilotRunSummary; summaryUrl: string }> {
  const summaryUrl = deriveSummaryUrl(reportUrl);
  const summaryBuffer = await downloadFile(summaryUrl);

  return {
    summary: JSON.parse(summaryBuffer.toString("utf8")) as AutopilotRunSummary,
    summaryUrl,
  };
}

export async function loadRunEvidenceFromReportUrl(
  reportUrl: string,
  runId: string,
): Promise<{ summaryUrl: string; evidence: RunEvidenceJourney[]; summary: AutopilotRunSummary }> {
  const { summary, summaryUrl } = await loadRunSummaryFromReportUrl(reportUrl);

  return {
    summaryUrl,
    evidence: buildEvidenceFromSummary(summary, runId),
    summary,
  };
}

export function findEvidenceManifest(
  summary: AutopilotRunSummary,
  journeyId: string,
): EvidenceManifest | undefined {
  return summary.evidenceManifests.find((manifest) => manifest.journeyId === journeyId);
}

export function findEvidenceArtifact(
  summary: AutopilotRunSummary,
  journeyId: string,
  artifactId: string,
): AutopilotEvidence | undefined {
  return findEvidenceManifest(summary, journeyId)?.artifacts.find(
    (artifact) => artifact.id === artifactId,
  );
}

export function buildBlobArtifactUrl(
  reportUrl: string,
  journeyId: string,
  artifact: AutopilotEvidence,
): string {
  if (artifact.url) {
    return artifact.url;
  }

  const url = new URL(reportUrl);
  const reportPath = url.pathname;
  const reportFileIndex = reportPath.lastIndexOf("/");
  const basePath = reportPath.slice(0, reportFileIndex);

  url.pathname = `${basePath}/${encodeURIComponent(journeyId)}/${encodeURIComponent(basename(artifact.path))}`;
  url.search = "";
  return url.toString();
}

function replaceBlobFilename(blobUrl: string, filename: string): string {
  const url = new URL(blobUrl);
  const currentPath = url.pathname;
  const lastSlash = currentPath.lastIndexOf("/");
  url.pathname = `${currentPath.slice(0, lastSlash + 1)}${filename}`;
  url.search = "";
  return url.toString();
}
