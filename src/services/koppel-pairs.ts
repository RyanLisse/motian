import { getMatchesByIds } from "@/src/services/matches";

export type CandidateKoppelPair = { jobId: string; matchId?: string | null };
export type JobKoppelPair = { candidateId: string; matchId?: string | null };

/**
 * Resolve matchIds or jobIds into pairs for candidate-side koppel (POST /api/kandidaten/[id]/koppel).
 */
export async function resolveKoppelPairsForCandidate(
  candidateId: string,
  matchIds: string[] | undefined,
  jobIds: string[] | undefined,
): Promise<
  { ok: true; pairs: CandidateKoppelPair[] } | { ok: false; status: 400; body: { error: string } }
> {
  if (matchIds?.length) {
    const matchRecords = await getMatchesByIds(matchIds);
    const pairs = matchRecords
      .filter(
        (m): m is typeof m & { jobId: string } => m.candidateId === candidateId && m.jobId != null,
      )
      .map((m) => ({ jobId: m.jobId, matchId: m.id }));
    return { ok: true, pairs };
  }
  if (jobIds?.length) {
    return { ok: true, pairs: jobIds.map((jobId) => ({ jobId })) };
  }
  return {
    ok: false,
    status: 400,
    body: { error: "matchIds of jobIds verplicht (minimaal één item)" },
  };
}

/**
 * Resolve matchIds or candidateIds into pairs for job-side koppel (POST /api/vacatures/[id]/koppel).
 */
export async function resolveKoppelPairsForJob(
  jobId: string,
  matchIds: string[] | undefined,
  candidateIds: string[] | undefined,
): Promise<
  { ok: true; pairs: JobKoppelPair[] } | { ok: false; status: 400; body: { error: string } }
> {
  if (matchIds?.length) {
    const matchRecords = await getMatchesByIds(matchIds);
    const pairs = matchRecords
      .filter(
        (m): m is typeof m & { candidateId: string } => m.jobId === jobId && m.candidateId != null,
      )
      .map((m) => ({ candidateId: m.candidateId, matchId: m.id }));
    return { ok: true, pairs };
  }
  if (candidateIds?.length) {
    return { ok: true, pairs: candidateIds.map((candidateId) => ({ candidateId })) };
  }
  return {
    ok: false,
    status: 400,
    body: { error: "matchIds of candidateIds verplicht (minimaal één item)" },
  };
}
