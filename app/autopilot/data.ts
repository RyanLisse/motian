import { desc, eq } from "drizzle-orm";
import type { RunEvidenceJourney } from "@/src/autopilot/run-detail";
import { loadRunEvidenceFromReportUrl } from "@/src/autopilot/run-detail";
import { db } from "@/src/db";
import { autopilotFindings, autopilotRuns } from "@/src/db/schema";

export async function getAutopilotDashboardData() {
  const runs = await db
    .select()
    .from(autopilotRuns)
    .orderBy(desc(autopilotRuns.startedAt))
    .limit(20);

  const latestRun = runs[0] ?? null;

  let latestFindings: (typeof autopilotFindings.$inferSelect)[] = [];
  if (latestRun) {
    latestFindings = await db
      .select()
      .from(autopilotFindings)
      .where(eq(autopilotFindings.runId, latestRun.runId))
      .orderBy(desc(autopilotFindings.severity));
  }

  return { runs, latestRun, latestFindings };
}

export async function getRunDetail(runId: string) {
  const [run] = await db
    .select()
    .from(autopilotRuns)
    .where(eq(autopilotRuns.runId, runId))
    .limit(1);

  if (!run) return null;

  const findings = await db
    .select()
    .from(autopilotFindings)
    .where(eq(autopilotFindings.runId, runId))
    .orderBy(desc(autopilotFindings.severity));

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
}
