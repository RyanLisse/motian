import { getCandidatesByIds, listActiveCandidates } from "./candidates";
import { getJobById } from "./jobs";
import { createMatch } from "./matches";
import { computeMatchScore } from "./scoring";

export type GenerateMatchesForJobInput = {
  jobId: string;
  candidateIds?: string[];
  limit?: number;
};

export type GenerateMatchesForJobResult = {
  jobId: string;
  matchesCreated: number;
  duplicateMatches: number;
  totalCandidatesScored: number;
  topScore: number;
  errors: string[];
};

function isDuplicateError(err: unknown): boolean {
  const errMsg = String(err).toLowerCase();
  return errMsg.includes("unique") || errMsg.includes("duplicate");
}

/**
 * Score candidates for a job and persist top matches.
 * Mirrors the API behavior used by `/api/matches/genereren`.
 */
export async function generateMatchesForJob({
  jobId,
  candidateIds,
  limit = 10,
}: GenerateMatchesForJobInput): Promise<GenerateMatchesForJobResult> {
  const job = await getJobById(jobId);
  if (!job) {
    throw new Error("Opdracht niet gevonden");
  }

  const candidates = candidateIds?.length
    ? await getCandidatesByIds(candidateIds)
    : await listActiveCandidates(200);

  if (candidates.length === 0) {
    return {
      jobId,
      matchesCreated: 0,
      duplicateMatches: 0,
      totalCandidatesScored: 0,
      topScore: 0,
      errors: [],
    };
  }

  const scored = candidates.map((candidate) => ({
    candidate,
    ...computeMatchScore(job, candidate),
  }));
  scored.sort((a, b) => b.score - a.score);
  const topMatches = scored.slice(0, limit);

  let matchesCreated = 0;
  let duplicateMatches = 0;
  const errors: string[] = [];

  for (const match of topMatches) {
    try {
      await createMatch({
        jobId: job.id,
        candidateId: match.candidate.id,
        matchScore: match.score,
        confidence: match.confidence,
        reasoning: match.reasoning,
        model: match.model,
      });
      matchesCreated++;
    } catch (err) {
      if (isDuplicateError(err)) {
        duplicateMatches++;
      } else {
        errors.push(`Kandidaat ${match.candidate.id}: ${String(err)}`);
      }
    }
  }

  return {
    jobId,
    matchesCreated,
    duplicateMatches,
    totalCandidatesScored: candidates.length,
    topScore: topMatches[0]?.score ?? 0,
    errors,
  };
}
