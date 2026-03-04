import { notifySlack } from "../lib/notify-slack";
import type { StructuredMatchOutput } from "../schemas/matching";
import { type Candidate, getCandidateById, listActiveCandidates } from "./candidates";
import { embedCandidate } from "./embedding";
import { getJobById, type Job, listActiveJobs } from "./jobs";
import { type JudgeVerdict, judgeMatch } from "./match-judge";
import { createMatch, getMatchByJobAndCandidate } from "./matches";
import { extractRequirements } from "./requirement-extraction";
import { computeMatchScore } from "./scoring";
import { runStructuredMatch } from "./structured-matching";

// ========== Config ==========

const MIN_SCORE = 40;
const DEFAULT_TOP_N = 3;

// ========== Types ==========

export type AutoMatchResult = {
  jobId: string;
  jobTitle: string;
  company: string | null;
  location: string | null;
  candidateId: string;
  candidateName: string;
  quickScore: number;
  structuredResult: StructuredMatchOutput | null;
  judgeVerdict: JudgeVerdict | null;
  matchId: string;
  matchSaveError: boolean;
};

// ========== Helpers ==========

/** Run deep structured match for a candidate against a job. Returns null on failure. */
async function deepMatch(job: Job, candidate: Candidate): Promise<StructuredMatchOutput | null> {
  if (!job.description || job.description.length < 50) return null;
  if (!candidate.resumeRaw) return null;

  const requirements = await extractRequirements({
    title: job.title,
    description: job.description,
    requirements: job.requirements as unknown[],
    wishes: job.wishes as unknown[],
    competences: job.competences as unknown[],
  });

  if (requirements.length === 0) return null;

  return runStructuredMatch({
    requirements,
    candidateName: candidate.name,
    cvText: candidate.resumeRaw,
  });
}

/** Create or retrieve an existing match record. Returns the match ID. */
async function upsertMatch(
  jobId: string,
  candidateId: string,
  score: number,
  structured: StructuredMatchOutput | null,
): Promise<string> {
  try {
    const match = await createMatch({
      jobId,
      candidateId,
      matchScore: structured?.overallScore ?? score,
      confidence: structured?.recommendationConfidence ?? undefined,
      reasoning: structured?.recommendationReasoning ?? undefined,
      model: "auto-match-v1",
      criteriaBreakdown: structured?.criteriaBreakdown,
      riskProfile: structured?.riskProfile,
      enrichmentSuggestions: structured?.enrichmentSuggestions,
      recommendation: structured?.recommendation,
      recommendationConfidence: structured?.recommendationConfidence,
      assessmentModel: structured ? "auto-match-v1" : undefined,
    });
    return match.id;
  } catch (err) {
    // Duplicate match — retrieve existing
    const errMsg = String(err);
    if (errMsg.includes("unique") || errMsg.includes("duplicate")) {
      const existing = await getMatchByJobAndCandidate(jobId, candidateId);
      if (existing) return existing.id;
    }
    throw err;
  }
}

// ========== Shared Auto-Match Pipeline ==========

/**
 * Generic auto-match pipeline: score pairs → deep match top N → judge → persist.
 * Used by both candidate→jobs and job→candidates directions.
 */
async function runAutoMatchPipeline(
  pairs: Array<{ job: Job; candidate: Candidate; score: number }>,
  topN: number = DEFAULT_TOP_N,
): Promise<AutoMatchResult[]> {
  const top = pairs
    .sort((a, b) => b.score - a.score)
    .filter((p) => p.score >= MIN_SCORE)
    .slice(0, topN);

  if (top.length === 0) return [];

  return Promise.all(
    top.map(async ({ job: j, candidate: c, score }): Promise<AutoMatchResult> => {
      let structuredResult: StructuredMatchOutput | null = null;
      try {
        structuredResult = await deepMatch(j, c);
      } catch (err) {
        console.error(`[Auto-Match] Deep match failed for job ${j.id} / candidate ${c.id}:`, err);
      }

      let judgeVerdict: JudgeVerdict | null = null;
      if (structuredResult) {
        try {
          judgeVerdict = await judgeMatch({
            jobTitle: j.title,
            candidateName: c.name,
            cvSummary: (c.resumeRaw ?? "").slice(0, 2000),
            structuredResult,
          });
        } catch (err) {
          console.error(`[Auto-Match] Judge failed for job ${j.id} / candidate ${c.id}:`, err);
        }
      }

      let matchId = "";
      let matchSaveError = false;
      try {
        matchId = await upsertMatch(j.id, c.id, score, structuredResult);
      } catch (err) {
        matchSaveError = true;
        console.error(`[Auto-Match] Create match failed for job ${j.id} / candidate ${c.id}:`, err);
      }

      if (matchId && !matchSaveError) {
        notifySlack("match:created", {
          candidateName: c.name,
          jobTitle: j.title,
          company: j.company,
          matchScore: structuredResult?.overallScore ?? score,
          recommendation: structuredResult?.recommendation,
          matchId,
        });
      }

      return {
        jobId: j.id,
        jobTitle: j.title,
        company: j.company,
        location: j.location,
        candidateId: c.id,
        candidateName: c.name,
        quickScore: score,
        structuredResult,
        judgeVerdict,
        matchId,
        matchSaveError,
      };
    }),
  );
}

// ========== Candidate → Jobs ==========

/**
 * Auto-match a candidate to their top 3 best-fitting jobs.
 *
 * 1. Ensures embedding exists (for hybrid scoring)
 * 2. Pre-filters all active jobs via computeMatchScore (~2s)
 * 3. Deep structured match for top 3 with score >= 40% (~8-12s parallel)
 * 4. Creates match records in jobMatches table
 */
export async function autoMatchCandidateToJobs(
  candidateId: string,
  topN: number = DEFAULT_TOP_N,
): Promise<AutoMatchResult[]> {
  const candidate = await getCandidateById(candidateId);
  if (!candidate) throw new Error("Kandidaat niet gevonden");

  try {
    await embedCandidate(candidateId);
  } catch (err) {
    console.warn("[Auto-Match] Embedding failed, falling back to rule-based:", err);
  }

  const freshCandidate = await getCandidateById(candidateId);
  if (!freshCandidate) throw new Error("Kandidaat niet gevonden na embedding");

  const activeJobs = await listActiveJobs(200);
  if (activeJobs.length === 0) return [];

  const pairs = activeJobs.map((job) => ({
    job,
    candidate: freshCandidate,
    ...computeMatchScore(job, freshCandidate),
  }));

  return runAutoMatchPipeline(pairs, topN);
}

// ========== Job → Candidates ==========

/**
 * Auto-match a job to its top 3 best-fitting candidates.
 */
export async function autoMatchJobToCandidates(
  jobId: string,
  topN: number = DEFAULT_TOP_N,
): Promise<AutoMatchResult[]> {
  const job = await getJobById(jobId);
  if (!job) throw new Error("Opdracht niet gevonden");

  const activeCandidates = await listActiveCandidates(200);
  if (activeCandidates.length === 0) return [];

  const pairs = activeCandidates.map((candidate) => ({
    job,
    candidate,
    ...computeMatchScore(job, candidate),
  }));

  return runAutoMatchPipeline(pairs, topN);
}
