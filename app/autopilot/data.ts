import { desc, eq } from "drizzle-orm";
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

  return { run, findings };
}

