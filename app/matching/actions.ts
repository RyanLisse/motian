"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/src/db";
import { jobMatches } from "@/src/db/schema";
import { getMatchByJobAndCandidate } from "@/src/services/matches";

export async function updateMatchStatus(matchId: string, status: "approved" | "rejected") {
  await db
    .update(jobMatches)
    .set({
      status,
      reviewedAt: new Date(),
      reviewedBy: "system",
    })
    .where(eq(jobMatches.id, matchId));

  revalidatePath("/matching");
}

/** Koppel een kandidaat aan een opdracht: bestaand match-record → approved, of nieuw record aanmaken. */
export async function linkCandidateToJob(
  jobId: string,
  candidateId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = await getMatchByJobAndCandidate(jobId, candidateId);

    if (existing) {
      await db
        .update(jobMatches)
        .set({
          status: "approved",
          reviewedAt: new Date(),
          reviewedBy: "system",
        })
        .where(eq(jobMatches.id, existing.id));
    } else {
      // Insert directly as approved — single atomic operation, no intermediate "pending" state
      await db.insert(jobMatches).values({
        jobId,
        candidateId,
        matchScore: 0,
        reasoning: "Handmatige koppeling",
        model: "manual",
        status: "approved",
        reviewedAt: new Date(),
        reviewedBy: "system",
      });
    }

    revalidatePath("/matching");
    return { success: true };
  } catch (err) {
    // Handle unique constraint violation gracefully (race condition)
    const message = err instanceof Error ? err.message : "Onbekende fout";
    if (message.includes("uq_job_matches_job_candidate")) {
      revalidatePath("/matching");
      return { success: true }; // Idempotent: already linked
    }
    return { success: false, error: message };
  }
}
