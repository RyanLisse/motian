"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/src/db";
import { jobMatches } from "@/src/db/schema";
import { createOrReuseApplicationForMatch } from "@/src/services/applications";
import { getCandidateById } from "@/src/services/candidates";
import { getJobById } from "@/src/services/jobs";
import {
  getMatchByJobAndCandidate,
  updateMatchStatus as updateMatchRecordStatus,
} from "@/src/services/matches";
import { extractRequirements } from "@/src/services/requirement-extraction";
import { runStructuredMatch } from "@/src/services/structured-matching";

export async function updateMatchStatus(matchId: string, status: "approved" | "rejected") {
  const match = await updateMatchRecordStatus(matchId, status, "system");
  if (!match) throw new Error("Match niet gevonden");

  revalidatePath("/matching");
  revalidatePath("/pipeline");
}

/** Koppel een kandidaat aan een opdracht: bestaand match-record → approved, of nieuw record aanmaken. */
export async function linkCandidateToJob(
  jobId: string,
  candidateId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = await getMatchByJobAndCandidate(jobId, candidateId);

    if (existing) {
      await updateMatchRecordStatus(existing.id, "approved", "system");
    } else {
      // Insert directly as approved — single atomic operation, no intermediate "pending" state
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
    revalidatePath("/pipeline");
    return { success: true };
  } catch (err) {
    // Handle unique constraint violation gracefully (race condition)
    const message = err instanceof Error ? err.message : "Onbekende fout";
    if (message.includes("uq_job_matches_job_candidate")) {
      const concurrent = await getMatchByJobAndCandidate(jobId, candidateId);
      if (concurrent) {
        await updateMatchRecordStatus(concurrent.id, "approved", "system");
      }
      revalidatePath("/matching");
      revalidatePath("/pipeline");
      return { success: true }; // Idempotent: already linked
    }
    return { success: false, error: message };
  }
}

/** Voer een gestructureerde Marienne-beoordeling uit voor een job+kandidaat paar. */
export async function runStructuredMatchAction(
  jobId: string,
  candidateId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const [job, candidate] = await Promise.all([getJobById(jobId), getCandidateById(candidateId)]);
    if (!job) return { success: false, error: "Opdracht niet gevonden" };
    if (!candidate) return { success: false, error: "Kandidaat niet gevonden" };

    const requirements = await extractRequirements({
      title: job.title,
      description: job.description,
      requirements: job.requirements,
      wishes: job.wishes,
      competences: job.competences,
    });

    if (requirements.length === 0) {
      return { success: false, error: "Geen eisen gevonden in opdracht" };
    }

    const cvText =
      candidate.resumeRaw ??
      [
        candidate.name,
        candidate.role,
        ...(Array.isArray(candidate.skills) ? (candidate.skills as string[]) : []),
      ].join(" ");

    const result = await runStructuredMatch({
      requirements,
      candidateName: candidate.name,
      cvText,
    });

    const existing = await getMatchByJobAndCandidate(jobId, candidateId);
    const matchData = {
      matchScore: result.overallScore,
      reasoning: result.recommendationReasoning,
      model: "marienne-v1",
      criteriaBreakdown: result.criteriaBreakdown,
      riskProfile: result.riskProfile,
      enrichmentSuggestions: result.enrichmentSuggestions,
      recommendation: result.recommendation,
      recommendationConfidence: result.recommendationConfidence,
      assessmentModel: "marienne-v1",
    };

    if (existing) {
      await db.update(jobMatches).set(matchData).where(eq(jobMatches.id, existing.id));
    } else {
      await db.insert(jobMatches).values({
        jobId,
        candidateId,
        status: "pending",
        ...matchData,
      });
    }

    revalidatePath("/matching");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout";
    return { success: false, error: message };
  }
}
