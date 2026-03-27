import { logger, metadata, task } from "@trigger.dev/sdk";
import { emitAgentEvent } from "@/src/services/agent-events";
import { autoMatchCandidateToJobs, autoMatchJobToCandidates } from "@/src/services/auto-matching";
import { createScreeningCall } from "@/src/services/screening-calls";

// Matches at or above this score auto-trigger a screening call
const AUTO_SCREEN_THRESHOLD = 60;

/**
 * Matcher Agent — runs semantic + structured matching and auto-triggers screening.
 *
 * Two modes:
 *   - candidate: Match a candidate to best-fitting jobs
 *   - job: Match a job to best-fitting candidates
 *
 * When a match scores ≥ 60%, automatically creates a screening call
 * and emits a `screening.requested` event for the Screener agent.
 */
export const agentMatcherTask = task({
  id: "agent-matcher",
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
      mode: "candidate" | "job";
      candidateId?: string;
      jobId?: string;
      topN?: number;
    },
    { ctx },
  ) => {
    const triggerRunId = ctx.run.id;

    metadata.set("agent", "matcher").set("mode", payload.mode).set("status", "matching");

    logger.info("Matcher agent gestart", { mode: payload.mode });

    // Run the appropriate matching direction
    const matches =
      payload.mode === "candidate" && payload.candidateId
        ? await autoMatchCandidateToJobs(payload.candidateId, payload.topN ?? 5)
        : payload.mode === "job" && payload.jobId
          ? await autoMatchJobToCandidates(payload.jobId, payload.topN ?? 5)
          : [];

    if (matches.length === 0) {
      logger.info("Matcher agent: geen matches gevonden");
      metadata.set("status", "complete").set("matchCount", 0);
      return { matches: [], screeningCallsCreated: 0 };
    }

    // Emit batch completion event
    await emitAgentEvent({
      sourceAgent: "matcher",
      eventType: "match.batch_completed",
      candidateId: payload.candidateId,
      jobId: payload.jobId,
      payload: {
        mode: payload.mode,
        matchCount: matches.length,
        topScore: matches[0]?.structuredResult?.overallScore ?? matches[0]?.quickScore ?? 0,
      },
      triggerRunId,
    });

    // Auto-trigger screening for high-scoring matches
    let screeningCallsCreated = 0;
    const screeningResults: Array<{
      matchId: string;
      score: number;
      screeningCallId: string | null;
    }> = [];

    for (const match of matches) {
      const effectiveScore = match.structuredResult?.overallScore ?? match.quickScore;

      if (effectiveScore >= AUTO_SCREEN_THRESHOLD && match.matchId && !match.matchSaveError) {
        try {
          const call = await createScreeningCall({
            candidateId: match.candidateId,
            jobId: match.jobId,
            matchId: match.matchId,
            initiatedBy: "ai_agent",
          });

          screeningCallsCreated++;

          // Emit screening.requested for the Screener agent
          await emitAgentEvent({
            sourceAgent: "matcher",
            eventType: "screening.requested",
            candidateId: match.candidateId,
            jobId: match.jobId,
            matchId: match.matchId,
            screeningCallId: call.id,
            payload: {
              score: effectiveScore,
              recommendation: match.structuredResult?.recommendation ?? null,
              candidateName: match.candidateName,
              jobTitle: match.jobTitle,
            },
            triggerRunId,
          });

          screeningResults.push({
            matchId: match.matchId,
            score: effectiveScore,
            screeningCallId: call.id,
          });

          logger.info("Screening call aangemaakt", {
            candidateId: match.candidateId,
            jobId: match.jobId,
            score: effectiveScore,
            screeningCallId: call.id,
          });
        } catch (err) {
          logger.error("Screening call aanmaken mislukt", {
            matchId: match.matchId,
            error: String(err),
          });
          screeningResults.push({
            matchId: match.matchId,
            score: effectiveScore,
            screeningCallId: null,
          });
        }
      }
    }

    metadata
      .set("status", "complete")
      .set("matchCount", matches.length)
      .set("screeningCallsCreated", screeningCallsCreated);

    logger.info("Matcher agent voltooid", {
      matchCount: matches.length,
      screeningCallsCreated,
    });

    return {
      matches: matches.map((m) => ({
        matchId: m.matchId,
        jobId: m.jobId,
        jobTitle: m.jobTitle,
        candidateId: m.candidateId,
        candidateName: m.candidateName,
        quickScore: m.quickScore,
        overallScore: m.structuredResult?.overallScore ?? m.quickScore,
        recommendation: m.structuredResult?.recommendation ?? null,
        judgeVerdict: m.judgeVerdict?.adjustedRecommendation ?? null,
      })),
      screeningCallsCreated,
      screeningResults,
    };
  },
});
