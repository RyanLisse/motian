import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/src/db";
import { jobMatches } from "@/src/db/schema";
import type { StructuredMatchOutput } from "@/src/schemas/matching";
import { getCandidateById } from "@/src/services/candidates";
import { getJobById } from "@/src/services/jobs";
import { getMatchByJobAndCandidate } from "@/src/services/matches";
import { extractRequirements } from "@/src/services/requirement-extraction";
import { runStructuredMatch } from "@/src/services/structured-matching";

const STRUCTURED_MATCH_MODEL = "marienne-v1";

type StructuredMatchReviewFailureReason =
  | "job_not_found"
  | "candidate_not_found"
  | "requirements_not_found";

export type StructuredMatchReviewOutcome =
  | { ok: true; result: StructuredMatchOutput }
  | { ok: false; reason: StructuredMatchReviewFailureReason; message: string };

function getCandidateCvText(candidate: {
  name: string;
  role: string | null;
  resumeRaw: string | null;
  skills: unknown;
}) {
  return (
    candidate.resumeRaw ??
    [
      candidate.name,
      candidate.role,
      ...(Array.isArray(candidate.skills) ? (candidate.skills as string[]) : []),
    ].join(" ")
  );
}

function getStructuredMatchData(result: StructuredMatchOutput) {
  return {
    matchScore: result.overallScore,
    reasoning: result.recommendationReasoning,
    model: STRUCTURED_MATCH_MODEL,
    criteriaBreakdown: result.criteriaBreakdown,
    riskProfile: result.riskProfile,
    enrichmentSuggestions: result.enrichmentSuggestions,
    recommendation: result.recommendation,
    recommendationConfidence: result.recommendationConfidence,
    assessmentModel: STRUCTURED_MATCH_MODEL,
  };
}

export async function runStructuredMatchReview(
  jobId: string,
  candidateId: string,
): Promise<StructuredMatchReviewOutcome> {
  const [job, candidate] = await Promise.all([getJobById(jobId), getCandidateById(candidateId)]);

  if (!job) {
    return { ok: false, reason: "job_not_found", message: "Opdracht niet gevonden" };
  }

  if (!candidate) {
    return { ok: false, reason: "candidate_not_found", message: "Kandidaat niet gevonden" };
  }

  const requirements = await extractRequirements({
    title: job.title,
    description: job.description,
    requirements: job.requirements,
    wishes: job.wishes,
    competences: job.competences,
  });

  if (requirements.length === 0) {
    return {
      ok: false,
      reason: "requirements_not_found",
      message: "Geen eisen gevonden in opdracht",
    };
  }

  const result = await runStructuredMatch({
    requirements,
    candidateName: candidate.name,
    cvText: getCandidateCvText(candidate),
  });

  const existing = await getMatchByJobAndCandidate(jobId, candidateId);
  const matchData = getStructuredMatchData(result);

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

  return { ok: true, result };
}

export function revalidateStructuredMatchViews(
  jobId?: string | null,
  candidateId?: string | null,
  options: { includePipeline?: boolean } = {},
) {
  revalidatePath("/professionals");
  revalidatePath("/opdrachten");
  revalidatePath("/overzicht");

  if (options.includePipeline) {
    revalidatePath("/pipeline");
  }

  if (candidateId) {
    revalidatePath(`/professionals/${candidateId}`);
  }

  if (jobId) {
    revalidatePath(`/opdrachten/${jobId}`);
  }
}
