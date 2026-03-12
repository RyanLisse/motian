import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AutopilotRunSummary } from "@/src/autopilot/types/run";
import { uploadFile } from "@/src/lib/file-storage";

export interface UploadResult {
  reportUrl: string;
  summaryUrl: string;
  artifactUrls: Array<{ journeyId: string; kind: string; url: string }>;
}

/**
 * Upload the markdown report, JSON summary, and evidence artifacts to Vercel Blob.
 *
 * If an individual artifact upload fails, the error is logged and the upload
 * continues with the remaining artifacts.
 */
export async function uploadReportArtifacts(
  summary: AutopilotRunSummary,
  markdownReport: string,
  evidenceDir: string,
): Promise<UploadResult> {
  const { runId } = summary;
  const prefix = `autopilot/${runId}`;

  // Upload markdown report
  const reportBuffer = Buffer.from(markdownReport, "utf-8");
  const { url: reportUrl } = await uploadFile(reportBuffer, `${prefix}/report.md`, "text/markdown");

  // Upload JSON summary
  const summaryJson = JSON.stringify(summary, null, 2);
  const summaryBuffer = Buffer.from(summaryJson, "utf-8");
  const { url: summaryUrl } = await uploadFile(
    summaryBuffer,
    `${prefix}/summary.json`,
    "application/json",
  );

  // Upload evidence artifacts from each manifest
  const artifactUrls: UploadResult["artifactUrls"] = [];

  for (const manifest of summary.evidenceManifests) {
    for (const artifact of manifest.artifacts) {
      try {
        const filePath = join(evidenceDir, artifact.path);
        const fileBuffer = await readFile(filePath);
        const contentType = inferContentType(artifact.kind);
        const blobPath = `${prefix}/${manifest.journeyId}/${artifact.path.split("/").pop() ?? artifact.id}`;
        const { url } = await uploadFile(fileBuffer, blobPath, contentType);
        artifactUrls.push({
          journeyId: manifest.journeyId,
          kind: artifact.kind,
          url,
        });
      } catch (err) {
        console.error(
          `[autopilot] Failed to upload artifact ${artifact.id} for journey ${manifest.journeyId}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  return { reportUrl, summaryUrl, artifactUrls };
}

/**
 * Map evidence kind to a MIME content type.
 */
function inferContentType(kind: string): string {
  switch (kind) {
    case "screenshot":
      return "image/png";
    case "video":
      return "video/webm";
    case "har":
      return "application/json";
    case "trace":
      return "application/json";
    case "console-log":
    case "network-log":
      return "text/plain";
    default:
      return "application/octet-stream";
  }
}
