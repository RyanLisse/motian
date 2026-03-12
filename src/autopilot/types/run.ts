import type { EvidenceManifest } from "./evidence";
import type { AutopilotFinding } from "./finding";

export type AutopilotRunStatus = "running" | "completed" | "failed" | "timed_out";

export interface AutopilotRunSummary {
  runId: string;
  status: AutopilotRunStatus;
  /** ISO 8601 timestamp */
  startedAt: string;
  /** ISO 8601 timestamp */
  completedAt?: string;
  commitSha: string;
  journeyResults: JourneyResult[];
  findings: AutopilotFinding[];
  evidenceManifests: EvidenceManifest[];
  stats: RunStats;
}

export interface JourneyResult {
  journeyId: string;
  surface: string;
  success: boolean;
  durationMs: number;
  errorMessage?: string;
  evidenceManifestId?: string;
}

export interface RunStats {
  totalJourneys: number;
  passedJourneys: number;
  failedJourneys: number;
  totalFindings: number;
  findingsBySeverity: Record<string, number>;
  findingsByCategory: Record<string, number>;
}
