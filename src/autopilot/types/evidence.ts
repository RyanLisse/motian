export type EvidenceKind = "screenshot" | "console-log" | "network-log" | "video" | "trace" | "har";

export interface AutopilotEvidence {
  id: string;
  findingId?: string;
  kind: EvidenceKind;
  /** Local or blob path */
  path: string;
  /** Public URL after upload */
  url?: string;
  /** ISO 8601 timestamp */
  capturedAt: string;
  metadata?: Record<string, unknown>;
}

export interface EvidenceManifest {
  runId: string;
  journeyId: string;
  surface: string;
  /** ISO 8601 timestamp */
  capturedAt: string;
  gitSha: string;
  artifacts: AutopilotEvidence[];
  success: boolean;
  failureReason?: string;
}
