"use server";

import { updateMatchStatus as updateMatchRecordStatus } from "@/src/services/matches";
import {
  revalidateStructuredMatchViews,
  runStructuredMatchReview,
} from "@/src/services/structured-match-review";

export async function updateMatchStatusAction(matchId: string, status: "approved" | "rejected") {
  const match = await updateMatchRecordStatus(matchId, status, "system");
  if (!match) throw new Error("Match niet gevonden");

  revalidateStructuredMatchViews(match.jobId, match.candidateId, { includePipeline: true });
}

/** Voer een gestructureerde Marienne-beoordeling uit voor een job+kandidaat paar. */
export async function runStructuredMatchAction(
  jobId: string,
  candidateId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const outcome = await runStructuredMatchReview(jobId, candidateId);

    if (!outcome.ok) {
      return { success: false, error: outcome.message };
    }

    revalidateStructuredMatchViews(jobId, candidateId, { includePipeline: true });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout";
    return { success: false, error: message };
  }
}
