"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/src/db";
import { jobMatches } from "@/src/db/schema";
import { createOrReuseApplicationForMatch } from "@/src/services/applications";
import { getMatchByJobAndCandidate, updateMatchStatus } from "@/src/services/matches";

/** Koppel een kandidaat aan een opdracht: bestaand match-record → approved, of nieuw record aanmaken. */
export async function linkCandidateToJob(
  jobId: string,
  candidateId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = await getMatchByJobAndCandidate(jobId, candidateId);

    if (existing) {
      await updateMatchStatus(existing.id, "approved", "system");
    } else {
      const [match] = await db
        .insert(jobMatches)
        .values({
          jobId,
          candidateId,
          matchScore: 0,
          reasoning: "Handmatige koppeling",
          model: "manual",
          status: "approved",
          reviewedAt: new Date(),
          reviewedBy: "system",
        })
        .returning();

      await createOrReuseApplicationForMatch({
        jobId,
        candidateId,
        matchId: match.id,
        stage: "screening",
      });
    }

    revalidatePath("/kandidaten");
    revalidatePath("/vacatures");
    revalidatePath("/pipeline");
    revalidatePath("/overzicht");
    revalidatePath(`/kandidaten/${candidateId}`);
    revalidatePath(`/vacatures/${jobId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout";
    if (message.includes("uq_job_matches_job_candidate")) {
      const concurrent = await getMatchByJobAndCandidate(jobId, candidateId);
      if (concurrent) {
        await updateMatchStatus(concurrent.id, "approved", "system");
      }
      revalidatePath("/kandidaten");
      revalidatePath("/vacatures");
      revalidatePath("/pipeline");
      revalidatePath("/overzicht");
      revalidatePath(`/kandidaten/${candidateId}`);
      revalidatePath(`/vacatures/${jobId}`);
      return { success: true };
    }
    return { success: false, error: message };
  }
}
