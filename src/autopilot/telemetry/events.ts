import { trackServerEvent } from "@/src/lib/posthog";
import type { AutopilotRunSummary } from "../types/run";

const DISTINCT_ID = "autopilot-system";

export function trackAutopilotRunStarted(runId: string, journeyCount: number): void {
  trackServerEvent(DISTINCT_ID, "autopilot_run_started", {
    runId,
    journeyCount,
    timestamp: new Date().toISOString(),
  });
}

export function trackAutopilotRunCompleted(summary: AutopilotRunSummary): void {
  trackServerEvent(DISTINCT_ID, "autopilot_run_completed", {
    runId: summary.runId,
    status: summary.status,
    totalJourneys: summary.stats.totalJourneys,
    passedJourneys: summary.stats.passedJourneys,
    failedJourneys: summary.stats.failedJourneys,
    totalFindings: summary.stats.totalFindings,
    durationMs:
      summary.completedAt && summary.startedAt
        ? new Date(summary.completedAt).getTime() - new Date(summary.startedAt).getTime()
        : undefined,
    commitSha: summary.commitSha,
  });
}

export function trackAutopilotRunFailed(runId: string, error: string): void {
  trackServerEvent(DISTINCT_ID, "autopilot_run_failed", {
    runId,
    error,
    timestamp: new Date().toISOString(),
  });
}

export function trackAutopilotIssuePublished(
  runId: string,
  findingId: string,
  issueNumber: number,
  created: boolean,
): void {
  trackServerEvent(DISTINCT_ID, "autopilot_issue_published", {
    runId,
    findingId,
    issueNumber,
    action: created ? "created" : "updated",
  });
}

export interface AutopilotStorageUsageStats {
  originalBytes: number;
  uploadedBytes: number;
  compressedBytes: number;
  traceBytes: number;
  harBytes: number;
  uploadedArtifacts: number;
  skippedRichArtifacts: number;
}

export function trackAutopilotStorageUsage(runId: string, stats: AutopilotStorageUsageStats): void {
  trackServerEvent(DISTINCT_ID, "autopilot_storage_usage", {
    runId,
    ...stats,
    compressionRatio:
      stats.originalBytes > 0 ? Number((stats.uploadedBytes / stats.originalBytes).toFixed(4)) : 1,
    timestamp: new Date().toISOString(),
  });
}
