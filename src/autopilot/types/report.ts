import type { AutopilotRunSummary } from "./run";

export interface MorningReport {
  /** ISO 8601 timestamp */
  generatedAt: string;
  runSummary: AutopilotRunSummary;
  topFindings: ReportFindingEntry[];
  brokenFlows: string[];
  newIssueUrls: string[];
  reportArtifactUrl?: string;
}

export interface ReportFindingEntry {
  title: string;
  category: string;
  severity: string;
  surface: string;
  confidence: number;
  evidenceUrls: string[];
  githubIssueUrl?: string;
}
