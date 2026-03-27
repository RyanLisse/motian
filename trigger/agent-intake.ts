import { logger, metadata, task } from "@trigger.dev/sdk";
import { emitAgentEvent } from "@/src/services/agent-events";
import { type AllowedMimeType, processStoredCV } from "@/src/services/cv-analysis-pipeline";

/**
 * Intake Agent — orchestrates the full CV-to-candidate pipeline:
 *   1. Parse CV (AI extraction)
 *   2. Enrich & grade candidate
 *   3. Embed for vector search
 *   4. Auto-match to open jobs
 *   5. Emit agent events at each stage
 *
 * Wraps the existing `processStoredCV` pipeline and adds
 * persistent event tracking for downstream agents.
 */
export const agentIntakeTask = task({
  id: "agent-intake",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30_000,
    randomize: true,
  },
  machine: { preset: "medium-1x" },
  maxDuration: 300, // 5 minutes
  run: async (
    payload: {
      fileUrl: string;
      fileName: string;
      mimeType: AllowedMimeType;
      fileHash: string;
      sessionId?: string | null;
      /** When true, auto-triggers matcher agent for each created match */
      autoMatch?: boolean;
    },
    { ctx },
  ) => {
    const triggerRunId = ctx.run.id;

    metadata.set("agent", "intake").set("status", "starting").set("fileName", payload.fileName);

    logger.info("Intake agent gestart", {
      fileName: payload.fileName,
      fileHash: payload.fileHash,
    });

    // Run the full CV pipeline (parse → grade → dedup → match)
    const result = await processStoredCV(
      {
        fileUrl: payload.fileUrl,
        mimeType: payload.mimeType,
        topN: 5, // More matches for agent-driven screening
      },
      async (event) => {
        metadata
          .set("status", event.status)
          .set("step", event.step)
          .set("label", event.label)
          .set("detail", event.detail ?? null);
      },
    );

    // Emit: candidate parsed & enriched
    await emitAgentEvent({
      sourceAgent: "intake",
      eventType: "candidate.parsed",
      candidateId: result.candidate.id,
      payload: {
        name: result.candidate.name,
        gradeScore: result.gradeScore,
        gradeLabel: result.gradeLabel,
        isExistingCandidate: result.isExistingCandidate,
        fileName: payload.fileName,
      },
      triggerRunId,
    });

    // Emit: candidate embedded (if embedding was generated)
    await emitAgentEvent({
      sourceAgent: "intake",
      eventType: "candidate.embedded",
      candidateId: result.candidate.id,
      payload: {
        matchCount: result.matches.length,
      },
      triggerRunId,
    });

    // Emit match.created events for each auto-match result
    // These events trigger the matcher agent for deep scoring
    for (const match of result.matches) {
      if (match.matchId && !match.matchSaveError) {
        await emitAgentEvent({
          sourceAgent: "intake",
          eventType: "match.created",
          candidateId: result.candidate.id,
          jobId: match.jobId,
          matchId: match.matchId,
          payload: {
            quickScore: match.quickScore,
            structuredScore: match.structuredResult?.overallScore ?? null,
            recommendation: match.structuredResult?.recommendation ?? null,
            candidateName: match.candidateName,
            jobTitle: match.jobTitle,
            company: match.company,
          },
          triggerRunId,
        });
      }
    }

    metadata
      .set("status", "complete")
      .set("candidateId", result.candidate.id)
      .set("matchCount", result.matches.length);

    logger.info("Intake agent voltooid", {
      candidateId: result.candidate.id,
      matchCount: result.matches.length,
      gradeScore: result.gradeScore,
    });

    return {
      candidateId: result.candidate.id,
      candidateName: result.candidate.name,
      matchCount: result.matches.length,
      matches: result.matches.map((m) => ({
        matchId: m.matchId,
        jobId: m.jobId,
        jobTitle: m.jobTitle,
        quickScore: m.quickScore,
        overallScore: m.structuredResult?.overallScore ?? m.quickScore,
        recommendation: m.structuredResult?.recommendation ?? null,
      })),
      gradeScore: result.gradeScore,
      gradeLabel: result.gradeLabel,
    };
  },
});
