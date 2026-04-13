import { getRunFindings } from "@/src/autopilot/persistence";
import type { RunEvidenceJourney } from "@/src/autopilot/run-detail";
import { loadRunEvidenceFromReportUrl } from "@/src/autopilot/run-detail";
import { db, desc, eq } from "@/src/db";
import { autopilotRuns } from "@/src/db/schema";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Onbekende fout";
}

export async function getAutopilotDashboardData() {
  try {
    const runs = await db
      .select()
      .from(autopilotRuns)
      .orderBy(desc(autopilotRuns.startedAt))
      .limit(20);

    return { runs, loadError: null };
  } catch (error) {
    const loadError = getErrorMessage(error);
    console.error("[autopilot] Failed to load dashboard data:", loadError);
    return {
      runs: [],
      loadError,
    };
  }
}

export async function getRunDetail(runId: string) {
  try {
    const [run] = await db
      .select()
      .from(autopilotRuns)
      .where(eq(autopilotRuns.runId, runId))
      .limit(1);

    if (!run) return null;

    const findings = await getRunFindings(runId);

    let summaryUrl: string | null = null;
    let evidence: RunEvidenceJourney[] = [];

    if (run.reportUrl) {
      try {
        const loaded = await loadRunEvidenceFromReportUrl(run.reportUrl, run.runId);
        summaryUrl = loaded.summaryUrl;
        evidence = loaded.evidence;
      } catch (error) {
        console.error(
          `[autopilot] Failed to load summary artifact for run ${run.runId}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    return { run, findings, summaryUrl, evidence };
  } catch (error) {
    console.error(
      `[autopilot] Failed to load run detail for ${runId}:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
