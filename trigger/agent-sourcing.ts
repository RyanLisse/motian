import { logger, metadata, schedules, task } from "@trigger.dev/sdk";
import { and, db, isNotNull, sql } from "@/src/db";
import { jobs } from "@/src/db/schema";
import { emitAgentEvent } from "@/src/services/agent-events";
import { autoMatchJobToCandidates } from "@/src/services/auto-matching";
import { getVisibleVacancyCondition } from "@/src/services/jobs/filters";

/**
 * Sourcing Agent — proactively searches for candidates for open jobs.
 *
 * Two modes:
 *   1. Scheduled: Runs nightly, finds jobs with few/no matches and sources candidates
 *   2. On-demand: Triggered for a specific job to find candidates immediately
 *
 * The agent identifies "underserved" jobs (fewer than 3 active matches)
 * and runs the auto-matching pipeline to find suitable candidates.
 */

// ---------- On-demand sourcing for a specific job ----------

export const agentSourcingTask = task({
  id: "agent-sourcing",
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 30_000,
  },
  machine: { preset: "medium-1x" },
  maxDuration: 300,
  run: async (
    payload: {
      jobId: string;
      topN?: number;
      /** Minimum match score to consider a sourced candidate */
      minScore?: number;
    },
    { ctx },
  ) => {
    const triggerRunId = ctx.run.id;
    const { jobId, topN = 5, minScore = 40 } = payload;

    metadata
      .set("agent", "sourcing")
      .set("mode", "on-demand")
      .set("jobId", jobId)
      .set("status", "searching");

    logger.info("Sourcing agent gestart (on-demand)", { jobId });

    const matches = await autoMatchJobToCandidates(jobId, topN);

    const qualifiedMatches = matches.filter((m) => {
      const score = m.structuredResult?.overallScore ?? m.quickScore;
      return score >= minScore && !m.matchSaveError;
    });

    // Emit events for each sourced candidate
    for (const match of qualifiedMatches) {
      await emitAgentEvent({
        sourceAgent: "sourcing",
        eventType: "sourcing.candidate_found",
        candidateId: match.candidateId,
        jobId: match.jobId,
        matchId: match.matchId,
        payload: {
          score: match.structuredResult?.overallScore ?? match.quickScore,
          recommendation: match.structuredResult?.recommendation ?? null,
          candidateName: match.candidateName,
          jobTitle: match.jobTitle,
        },
        triggerRunId,
      });
    }

    await emitAgentEvent({
      sourceAgent: "sourcing",
      eventType: "sourcing.search_completed",
      jobId,
      payload: {
        mode: "on-demand",
        totalCandidatesScanned: matches.length,
        qualifiedFound: qualifiedMatches.length,
        topScore:
          qualifiedMatches[0]?.structuredResult?.overallScore ??
          qualifiedMatches[0]?.quickScore ??
          0,
      },
      triggerRunId,
    });

    metadata.set("status", "complete").set("qualifiedFound", qualifiedMatches.length);

    logger.info("Sourcing agent voltooid (on-demand)", {
      jobId,
      totalMatches: matches.length,
      qualifiedMatches: qualifiedMatches.length,
    });

    return {
      jobId,
      totalScanned: matches.length,
      qualifiedFound: qualifiedMatches.length,
      matches: qualifiedMatches.map((m) => ({
        matchId: m.matchId,
        candidateId: m.candidateId,
        candidateName: m.candidateName,
        score: m.structuredResult?.overallScore ?? m.quickScore,
        recommendation: m.structuredResult?.recommendation ?? null,
      })),
    };
  },
});

// ---------- Nightly proactive sourcing ----------

export const agentSourcingNightlyTask = schedules.task({
  id: "agent-sourcing-nightly",
  cron: {
    pattern: "0 3 * * *", // Every night at 03:00
    timezone: "Europe/Amsterdam",
  },
  maxDuration: 600, // 10 minutes
  run: async () => {
    logger.info("Nightly sourcing agent gestart");

    // Find active jobs with fewer than 3 pending/accepted matches
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
          isNotNull(jobs.embedding), // Only jobs with embeddings
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
      .limit(10); // Process max 10 jobs per night

    if (underservedJobs.length === 0) {
      logger.info("Geen ondervoorziene vacatures gevonden");
      return { jobsProcessed: 0, totalCandidatesFound: 0 };
    }

    logger.info(`${underservedJobs.length} ondervoorziene vacatures gevonden`);

    let totalCandidatesFound = 0;
    const results: Array<{
      jobId: string;
      jobTitle: string;
      candidatesFound: number;
    }> = [];

    for (const job of underservedJobs) {
      try {
        const matches = await autoMatchJobToCandidates(job.id, 3);
        const qualified = matches.filter(
          (m) => (m.structuredResult?.overallScore ?? m.quickScore) >= 40 && !m.matchSaveError,
        );

        totalCandidatesFound += qualified.length;
        results.push({
          jobId: job.id,
          jobTitle: job.title,
          candidatesFound: qualified.length,
        });

        // Emit sourcing event per found candidate
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
        logger.error(`Sourcing mislukt voor vacature ${job.id}`, {
          error: String(err),
        });
        results.push({
          jobId: job.id,
          jobTitle: job.title,
          candidatesFound: 0,
        });
      }
    }

    await emitAgentEvent({
      sourceAgent: "sourcing",
      eventType: "sourcing.search_completed",
      payload: {
        mode: "nightly",
        jobsProcessed: underservedJobs.length,
        totalCandidatesFound,
      },
    });

    logger.info("Nightly sourcing agent voltooid", {
      jobsProcessed: underservedJobs.length,
      totalCandidatesFound,
    });

    return {
      jobsProcessed: underservedJobs.length,
      totalCandidatesFound,
      results,
    };
  },
});
