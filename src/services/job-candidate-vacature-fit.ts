import { getCandidateById } from "./candidates";
import { getJobById } from "./jobs/repository";
import { computeMatchScore } from "./scoring";

const MAX_JOBS = 30;

export type VacatureFitRow = {
  jobId: string;
  score: number;
  confidence: number;
  reasoning: string;
  model: string;
};

/**
 * Rule + optional vector match scores for a candidate against explicit vacatures (#152).
 */
export async function scoreVacaturesForCandidate(
  candidateId: string,
  jobIds: string[],
): Promise<VacatureFitRow[]> {
  const candidate = await getCandidateById(candidateId);
  if (!candidate) {
    throw new Error("Kandidaat niet gevonden");
  }

  const unique = [...new Set(jobIds)].slice(0, MAX_JOBS);
  const rows: VacatureFitRow[] = [];

  for (const jobId of unique) {
    const job = await getJobById(jobId);
    if (!job) continue;

    const match = computeMatchScore(job, candidate);
    rows.push({
      jobId,
      score: match.score,
      confidence: match.confidence,
      reasoning: match.reasoning,
      model: match.model,
    });
  }

  return rows;
}
