export type FindingCategory = "bug" | "ux" | "perf" | "ai-quality";
export type FindingSeverity = "critical" | "high" | "medium" | "low";
export type FindingStatus = "detected" | "validated" | "reported" | "dismissed";

export interface AutopilotFinding {
  id: string;
  runId: string;
  category: FindingCategory;
  surface: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  /** 0-1 */
  confidence: number;
  autoFixable: boolean;
  status: FindingStatus;
  /** For deduplication */
  fingerprint: string;
  suspectedRootCause?: string;
  recommendedAction?: string;
  metadata?: Record<string, unknown>;
}
