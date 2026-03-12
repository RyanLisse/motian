import { desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { autopilotFindings, autopilotRuns } from "@/src/db/schema";
import type { AutopilotFinding, AutopilotRunSummary, FindingStatus } from "../types";

export async function saveAutopilotRun(
  summary: AutopilotRunSummary,
  reportUrl?: string,
  triggerRunId?: string,
) {
  await db
    .insert(autopilotRuns)
    .values({
      runId: summary.runId,
      status: summary.status,
      startedAt: new Date(summary.startedAt),
      completedAt: summary.completedAt ? new Date(summary.completedAt) : null,
      commitSha: summary.commitSha,
      totalJourneys: summary.stats.totalJourneys,
      passedJourneys: summary.stats.passedJourneys,
      failedJourneys: summary.stats.failedJourneys,
      totalFindings: summary.stats.totalFindings,
      findingsBySeverity: summary.stats.findingsBySeverity,
      findingsByCategory: summary.stats.findingsByCategory,
      reportUrl: reportUrl ?? null,
      triggerRunId: triggerRunId ?? null,
    })
    .onConflictDoUpdate({
      target: autopilotRuns.runId,
      set: {
        status: summary.status,
        completedAt: summary.completedAt ? new Date(summary.completedAt) : null,
        totalFindings: summary.stats.totalFindings,
        findingsBySeverity: summary.stats.findingsBySeverity,
        findingsByCategory: summary.stats.findingsByCategory,
        reportUrl: reportUrl ?? null,
      },
    });
}

export async function saveAutopilotFindings(
  findings: AutopilotFinding[],
  githubIssueMap?: Map<string, number>,
) {
  if (findings.length === 0) return;

  for (const finding of findings) {
    await db
      .insert(autopilotFindings)
      .values({
        findingId: finding.id,
        runId: finding.runId,
        category: finding.category,
        surface: finding.surface,
        title: finding.title,
        description: finding.description,
        severity: finding.severity,
        confidence: finding.confidence,
        autoFixable: finding.autoFixable,
        status: finding.status,
        fingerprint: finding.fingerprint,
        suspectedRootCause: finding.suspectedRootCause ?? null,
        recommendedAction: finding.recommendedAction ?? null,
        githubIssueNumber: githubIssueMap?.get(finding.id) ?? null,
        metadata: finding.metadata ?? {},
      })
      .onConflictDoUpdate({
        target: autopilotFindings.findingId,
        set: {
          status: finding.status,
          githubIssueNumber: githubIssueMap?.get(finding.id) ?? null,
          updatedAt: new Date(),
        },
      });
  }
}

export async function getRecentRuns(limit = 20) {
  return db.select().from(autopilotRuns).orderBy(desc(autopilotRuns.startedAt)).limit(limit);
}

export async function getRunFindings(runId: string) {
  return db
    .select()
    .from(autopilotFindings)
    .where(eq(autopilotFindings.runId, runId))
    .orderBy(desc(autopilotFindings.severity));
}

export async function updateFindingStatus(findingId: string, status: FindingStatus) {
  return db
    .update(autopilotFindings)
    .set({ status, updatedAt: new Date() })
    .where(eq(autopilotFindings.findingId, findingId));
}

export async function getOpenFindings() {
  return db
    .select()
    .from(autopilotFindings)
    .where(eq(autopilotFindings.status, "detected"))
    .orderBy(desc(autopilotFindings.createdAt));
}
