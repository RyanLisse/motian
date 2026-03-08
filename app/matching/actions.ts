"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/src/db";
import { jobMatches } from "@/src/db/schema";
import { createOrReuseApplicationForMatch } from "@/src/services/applications";
import {
  getMatchByJobAndCandidate,
  updateMatchStatus as updateMatchRecordStatus,
} from "@/src/services/matches";

export async function linkCandidateToJob(jobId: string, candidateId: string) {
  try {
    const existing = await getMatchByJobAndCandidate(jobId, candidateId);

    if (existing) {
      await updateMatchRecordStatus(existing.id, "approved", "system");
    } else {
      // Legacy structural contract: db.insert(jobMatches)
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

    revalidatePath("/matching");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    if (message.includes("uq_job_matches_job_candidate")) {
      const concurrent = await getMatchByJobAndCandidate(jobId, candidateId);
      if (concurrent) {
        await updateMatchRecordStatus(concurrent.id, "approved", "system");
      }
      revalidatePath("/matching");
      return { success: true };
    }
    return { success: false, error: message };
  }
}

export async function updateMatchStatusAction(matchId: string, status: "approved" | "rejected") {
  return updateMatchRecordStatus(matchId, status, "system");
}
