import { logger, metadata, task } from "@trigger.dev/sdk";
import { emitAgentEvent } from "@/src/services/agent-events";
import { autoMatchJobToCandidates } from "@/src/services/auto-matching";

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

// Nightly proactive sourcing is now part of trigger/nightly-maintenance.ts
