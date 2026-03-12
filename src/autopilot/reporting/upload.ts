import { readFile } from "node:fs/promises";
import { basename, isAbsolute, join } from "node:path";
import { gzipSync } from "node:zlib";
import { inferEvidenceContentType } from "@/src/autopilot/evidence/content-type";
import { trackAutopilotStorageUsage } from "@/src/autopilot/telemetry";
import type { AutopilotRunSummary } from "@/src/autopilot/types/run";
import { uploadFile } from "@/src/lib/file-storage";

export interface UploadResult {
  reportUrl: string;
  summaryUrl: string;
  artifactUrls: Array<{ journeyId: string; kind: string; url: string }>;
}

const THIRTY_DAY_CACHE_SECONDS = 2_592_000;
const COMPRESSIBLE_ARTIFACT_KINDS = new Set(["har", "trace"]);
const FAILURES_ONLY_RICH_ARTIFACT_KINDS = new Set(["har", "trace", "video"]);
const COMPRESSION_THRESHOLD_BYTES = 1_000_000;

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
  const uploadedSummary = cloneSummary(summary);
  const storageStats = {
    originalBytes: 0,
    uploadedBytes: 0,
    compressedBytes: 0,
    traceBytes: 0,
    harBytes: 0,
    uploadedArtifacts: 0,
    skippedRichArtifacts: 0,
  };

  const reportBuffer = Buffer.from(markdownReport, "utf-8");
  const { url: reportUrl } = await uploadFile(
    reportBuffer,
    `${prefix}/report.md`,
    "text/markdown",
    {
      cacheControlMaxAge: THIRTY_DAY_CACHE_SECONDS,
    },
  );

  const artifactUrls: UploadResult["artifactUrls"] = [];

  for (const manifest of uploadedSummary.evidenceManifests) {
    for (const artifact of manifest.artifacts) {
      try {
        if (shouldSkipArtifactUpload(manifest.success, artifact.kind)) {
          storageStats.skippedRichArtifacts += 1;
          continue;
        }

        const filePath = resolveArtifactPath(evidenceDir, artifact.path);
        const fileBuffer = await readFile(filePath);
        const originalByteLength = fileBuffer.byteLength;
        storageStats.originalBytes += originalByteLength;

        if (artifact.kind === "trace") {
          storageStats.traceBytes += originalByteLength;
        }

        if (artifact.kind === "har") {
          storageStats.harBytes += originalByteLength;
        }

        let uploadBuffer = fileBuffer;
        let uploadFilename = basename(artifact.path);
        let metadata = artifact.metadata ? { ...artifact.metadata } : undefined;

        if (shouldCompressArtifact(artifact.kind, originalByteLength)) {
          uploadBuffer = gzipSync(fileBuffer);
          uploadFilename = `${uploadFilename}.gz`;
          metadata = { ...metadata, contentEncoding: "gzip" };
          storageStats.compressedBytes += originalByteLength - uploadBuffer.byteLength;
        }

        const contentType = inferEvidenceContentType(artifact.kind);
        const blobPath = `${prefix}/${manifest.journeyId}/${uploadFilename}`;
        const { pathname, url } = await uploadFile(uploadBuffer, blobPath, contentType, {
          cacheControlMaxAge: THIRTY_DAY_CACHE_SECONDS,
        });

        storageStats.uploadedBytes += uploadBuffer.byteLength;
        storageStats.uploadedArtifacts += 1;
        artifact.metadata = pathname ? { ...metadata, storagePath: pathname } : metadata;
        artifact.url = url;
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

  const summaryJson = JSON.stringify(uploadedSummary, null, 2);
  const summaryBuffer = Buffer.from(summaryJson, "utf-8");
  const { url: summaryUrl } = await uploadFile(
    summaryBuffer,
    `${prefix}/summary.json`,
    "application/json",
    { cacheControlMaxAge: THIRTY_DAY_CACHE_SECONDS },
  );

  trackAutopilotStorageUsage(runId, storageStats);

  return { reportUrl, summaryUrl, artifactUrls };
}

function cloneSummary(summary: AutopilotRunSummary): AutopilotRunSummary {
  return JSON.parse(JSON.stringify(summary)) as AutopilotRunSummary;
}

function resolveArtifactPath(evidenceDir: string, artifactPath: string): string {
  return isAbsolute(artifactPath) ? artifactPath : join(evidenceDir, artifactPath);
}

function shouldCompressArtifact(kind: string, byteLength: number): boolean {
  return COMPRESSIBLE_ARTIFACT_KINDS.has(kind) && byteLength > COMPRESSION_THRESHOLD_BYTES;
}

function shouldSkipArtifactUpload(success: boolean, kind: string): boolean {
  return (
    process.env.AUTOPILOT_RICH_EVIDENCE === "failures" &&
    success &&
    FAILURES_ONLY_RICH_ARTIFACT_KINDS.has(kind)
  );
}
