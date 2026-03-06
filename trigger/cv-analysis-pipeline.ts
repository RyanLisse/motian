import { metadata, task } from "@trigger.dev/sdk";
import { type AllowedMimeType, processStoredCV } from "@/src/services/cv-analysis-pipeline";

export const cvAnalysisPipelineTask = task({
  id: "cv-analysis-pipeline",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30000,
    randomize: true,
  },
  run: async (payload: {
    fileUrl: string;
    fileName: string;
    mimeType: AllowedMimeType;
    fileHash: string;
    sessionId?: string | null;
  }) => {
    metadata
      .set("status", "starting")
      .set("fileName", payload.fileName)
      .set("fileHash", payload.fileHash)
      .set("fileUrl", payload.fileUrl);

    const result = await processStoredCV(
      {
        fileUrl: payload.fileUrl,
        mimeType: payload.mimeType,
      },
      async (event) => {
        metadata
          .set("status", event.status)
          .set("step", event.step)
          .set("label", event.label)
          .set("detail", event.detail ?? null);

        if (event.gradeScore != null) {
          metadata.set("gradeScore", event.gradeScore).set("gradeLabel", event.gradeLabel ?? null);
        }
      },
    );

    metadata
      .set("status", "complete")
      .set("step", "done")
      .set("candidateId", result.candidate.id)
      .set("candidateName", result.candidate.name)
      .set("matchCount", result.matches.length)
      .set("isExistingCandidate", result.isExistingCandidate);

    // Structured flow log for baseline and Fase 4 observability
    console.log(
      JSON.stringify({
        flow: "cv_analyse",
        mode: "async",
        candidateId: result.candidate.id,
        matchCount: result.matches.length,
        isExistingCandidate: result.isExistingCandidate,
      }),
    );

    return result;
  },
});
