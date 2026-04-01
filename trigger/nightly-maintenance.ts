import { logger, schedules } from "@trigger.dev/sdk";
import { and, eq, lt } from "drizzle-orm";
import { db, isNotNull, sql } from "@/src/db";
import { jobs } from "@/src/db/schema";
import { eraseCandidateData, findExpiredRetentionCandidates } from "@/src/services/gdpr";
import { emitAgentEvent } from "@/src/services/agent-events";
import { autoMatchJobToCandidates } from "@/src/services/auto-matching";
import { getVisibleVacancyCondition } from "@/src/services/jobs/filters";

/**
 * Nightly maintenance — runs daily at 2:00 AM Amsterdam time.
 *
 * Consolidates three former schedules into sequential steps:
 *   1. Data retention cleanup (GDPR erasure of expired candidates)
 *   2. Vacancy expiry (close jobs past their application deadline)
 *   3. Proactive sourcing (find candidates for underserved jobs)
 */
export const nightlyMaintenanceTask = schedules.task({
  id: "nightly-maintenance",
  cron: {
    pattern: "0 2 * * *",
    timezone: "Europe/Amsterdam",
  },
  maxDuration: 600,
  run: async () => {
    // ── Step 1: GDPR data retention cleanup ──
    logger.info("Stap 1: Data retention cleanup");
    const expired = await findExpiredRetentionCandidates();
    let totalErased = 0;
    const retentionErrors: string[] = [];

    for (const candidate of expired) {
      try {
        const result = await eraseCandidateData(candidate.id);
        if (result.deletedCandidate) totalErased++;
      } catch (err) {
        retentionErrors.push(`Kandidaat ${candidate.id}: ${String(err)}`);
      }
    }

    logger.info("Data retention voltooid", {
      totalErased,
      totalExpired: expired.length,
      errors: retentionErrors.length,
    });

    // ── Step 2: Vacancy expiry ──
    logger.info("Stap 2: Vacature verloop check");
    const now = new Date();
    const expiredJobs = await db
      .update(jobs)
      .set({ status: "closed" })
      .where(and(eq(jobs.status, "open"), lt(jobs.applicationDeadline, now)))
      .returning({ id: jobs.id });

    logger.info("Vacature verloop voltooid", { expiredCount: expiredJobs.length });

    // ── Step 3: Proactive sourcing for underserved jobs ──
    logger.info("Stap 3: Proactieve sourcing");
    const underservedJobs = await db
      .select({
        id: jobs.id,
        title: jobs.title,
        matchCount: sql<number>`cast(coalesce(
          (select count(*) from job_matches jm
           where jm.job_id = ${jobs.id}
           and jm.status in ('pending', 'accepted')),
          0
        ) as integer)`,
      })
      .from(jobs)
      .where(
        and(
          getVisibleVacancyCondition(),
          isNotNull(jobs.embedding),
        ),
      )
      .having(
        sql`coalesce(
          (select count(*) from job_matches jm
           where jm.job_id = ${jobs.id}
           and jm.status in ('pending', 'accepted')),
          0
        ) < 3`,
      )
      .limit(10);

    let totalCandidatesFound = 0;
    const sourcingResults: Array<{ jobId: string; jobTitle: string; candidatesFound: number }> = [];

    for (const job of underservedJobs) {
      try {
        const matches = await autoMatchJobToCandidates(job.id, 3);
        const qualified = matches.filter(
          (m) => (m.structuredResult?.overallScore ?? m.quickScore) >= 40 && !m.matchSaveError,
        );

        totalCandidatesFound += qualified.length;
        sourcingResults.push({ jobId: job.id, jobTitle: job.title, candidatesFound: qualified.length });

        for (const match of qualified) {
          await emitAgentEvent({
            sourceAgent: "sourcing",
            eventType: "sourcing.candidate_found",
            candidateId: match.candidateId,
            jobId: match.jobId,
            matchId: match.matchId,
            payload: {
              score: match.structuredResult?.overallScore ?? match.quickScore,
              candidateName: match.candidateName,
              jobTitle: match.jobTitle,
              nightlyRun: true,
            },
          });
        }

        logger.info(`Vacature ${job.title}: ${qualified.length} kandidaten gevonden`);
      } catch (err) {
        logger.error(`Sourcing mislukt voor vacature ${job.id}`, { error: String(err) });
        sourcingResults.push({ jobId: job.id, jobTitle: job.title, candidatesFound: 0 });
      }
    }

    if (underservedJobs.length > 0) {
      await emitAgentEvent({
        sourceAgent: "sourcing",
        eventType: "sourcing.search_completed",
        payload: {
          mode: "nightly",
          jobsProcessed: underservedJobs.length,
          totalCandidatesFound,
        },
      });
    }

    logger.info("Nightly maintenance voltooid");

    return {
      dataRetention: { totalErased, totalExpired: expired.length, errors: retentionErrors },
      vacancyExpiry: { expiredCount: expiredJobs.length },
      sourcing: {
        jobsProcessed: underservedJobs.length,
        totalCandidatesFound,
        results: sourcingResults,
      },
    };
  },
});
