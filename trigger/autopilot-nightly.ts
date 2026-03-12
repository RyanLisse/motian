import { logger, schedules } from "@trigger.dev/sdk";
import { MVP_JOURNEYS } from "@/src/autopilot/config";
import { captureJourneyEvidence } from "@/src/autopilot/evidence";
import {
  trackAutopilotRunCompleted,
  trackAutopilotRunFailed,
  trackAutopilotRunStarted,
} from "@/src/autopilot/telemetry";
import type { AutopilotRunSummary, RunStats } from "@/src/autopilot/types";

function resolveBaseUrl(): string {
  if (process.env.AUTOPILOT_BASE_URL) {
    return process.env.AUTOPILOT_BASE_URL;
  }
  if (process.env.VERCEL_URL) {
    const url = process.env.VERCEL_URL;
    return url.startsWith("http") ? url : `https://${url}`;
  }
  return "http://localhost:3002";
}

export const autopilotNightlyTask = schedules.task({
  id: "autopilot-nightly",
  cron: {
    pattern: "0 4 * * *",
    timezone: "Europe/Amsterdam",
  },
  maxDuration: 300,
  retry: {
    maxAttempts: 2,
  },
  run: async () => {
    const baseUrl = resolveBaseUrl();
    const evidenceDir = process.env.AUTOPILOT_EVIDENCE_DIR ?? "/tmp/autopilot-evidence";

    logger.info("Autopilot nightly run gestart", { baseUrl, evidenceDir });
    trackAutopilotRunStarted("pending", MVP_JOURNEYS.length);

    try {
      const result = await captureJourneyEvidence(MVP_JOURNEYS, {
        baseUrl,
        evidenceDir,
      });

      const passedJourneys = result.journeyOutputs.filter((o) => o.result.success).length;
      const failedJourneys = result.journeyOutputs.filter((o) => !o.result.success).length;

      const stats: RunStats = {
        totalJourneys: result.journeyOutputs.length,
        passedJourneys,
        failedJourneys,
        totalFindings: 0,
        findingsBySeverity: {},
        findingsByCategory: {},
      };

      const summary: AutopilotRunSummary = {
        runId: result.runId,
        status: failedJourneys === 0 ? "completed" : "failed",
        startedAt: result.startedAt,
        completedAt: result.completedAt,
        commitSha: result.gitSha,
        journeyResults: result.journeyOutputs.map((o) => o.result),
        findings: [],
        evidenceManifests: result.journeyOutputs.map((o) => o.manifest),
        stats,
      };

      logger.info("Autopilot nightly run voltooid", {
        runId: summary.runId,
        status: summary.status,
        totalJourneys: stats.totalJourneys,
        passedJourneys: stats.passedJourneys,
        failedJourneys: stats.failedJourneys,
      });

      trackAutopilotRunCompleted(summary);

      return summary;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error("Autopilot nightly run mislukt", { error: errorMessage });
      trackAutopilotRunFailed("unknown", errorMessage);

      const failedSummary: AutopilotRunSummary = {
        runId: "unknown",
        status: "failed",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        commitSha: "unknown",
        journeyResults: [],
        findings: [],
        evidenceManifests: [],
        stats: {
          totalJourneys: 0,
          passedJourneys: 0,
          failedJourneys: 0,
          totalFindings: 0,
          findingsBySeverity: {},
          findingsByCategory: {},
        },
      };

      return failedSummary;
    }
  },
});
