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
const TOP_N = 3;

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

// ========== Candidate → Jobs ==========

/**
 * Auto-match a candidate to their top 3 best-fitting jobs.
 *
 * 1. Ensures embedding exists (for hybrid scoring)
 * 2. Pre-filters all active jobs via computeMatchScore (~2s)
 * 3. Deep structured match for top 3 with score ≥ 40% (~8-12s parallel)
 * 4. Creates match records in jobMatches table
 */
export async function autoMatchCandidateToJobs(candidateId: string): Promise<AutoMatchResult[]> {
  // 1. Get candidate
  const candidate = await getCandidateById(candidateId);
  if (!candidate) throw new Error("Kandidaat niet gevonden");

  // 2. Ensure embedding exists (await, don't fire-and-forget)
  try {
    await embedCandidate(candidateId);
  } catch (err) {
    console.warn("[Auto-Match] Embedding failed, falling back to rule-based:", err);
  }

  // Re-fetch candidate with updated embedding
  const freshCandidate = await getCandidateById(candidateId);
  if (!freshCandidate) throw new Error("Kandidaat niet gevonden na embedding");

  // 3. Get all active jobs and score
  const activeJobs = await listActiveJobs(200);
  if (activeJobs.length === 0) return [];

  const scored = activeJobs.map((job) => ({
    job,
    ...computeMatchScore(job, freshCandidate),
  }));
  scored.sort((a, b) => b.score - a.score);

  const topJobs = scored.filter((s) => s.score >= MIN_SCORE).slice(0, TOP_N);
  if (topJobs.length === 0) return [];

  // 4. Deep structured match + create matches in parallel
  const results = await Promise.all(
    topJobs.map(async ({ job, score }): Promise<AutoMatchResult> => {
      let structuredResult: StructuredMatchOutput | null = null;

      try {
        structuredResult = await deepMatch(job, freshCandidate);
      } catch (err) {
        console.error(`[Auto-Match] Deep match failed for job ${job.id}:`, err);
      }

      // 5. Run Grok judge on the structured result (non-fatal)
      let judgeVerdict: JudgeVerdict | null = null;
      if (structuredResult) {
        try {
          judgeVerdict = await judgeMatch({
            jobTitle: job.title,
            candidateName: freshCandidate.name,
            cvSummary: (freshCandidate.resumeRaw ?? "").slice(0, 2000),
            structuredResult,
          });
        } catch (err) {
          console.error(`[Auto-Match] Judge failed for job ${job.id}:`, err);
        }
      }

      let matchId = "";
      let matchSaveError = false;
      try {
        matchId = await upsertMatch(job.id, freshCandidate.id, score, structuredResult);
      } catch (err) {
        matchSaveError = true;
        console.error(`[Auto-Match] Create match failed for job ${job.id}:`, err);
      }

      // Slack notification for successful match (fire-and-forget)
      if (matchId && !matchSaveError) {
        notifySlack("match:created", {
          candidateName: freshCandidate.name,
          jobTitle: job.title,
          company: job.company,
          matchScore: structuredResult?.overallScore ?? score,
          recommendation: structuredResult?.recommendation,
          matchId,
        });
      }

      return {
        jobId: job.id,
        jobTitle: job.title,
        company: job.company,
        location: job.location,
        candidateId: freshCandidate.id,
        candidateName: freshCandidate.name,
        quickScore: score,
        structuredResult,
        judgeVerdict,
        matchId,
        matchSaveError,
      };
    }),
  );

  return results;
}

// ========== Job → Candidates ==========

/**
 * Auto-match a job to its top 3 best-fitting candidates.
 * Mirror of autoMatchCandidateToJobs but in the reverse direction.
 */
export async function autoMatchJobToCandidates(jobId: string): Promise<AutoMatchResult[]> {
  const job = await getJobById(jobId);
  if (!job) throw new Error("Opdracht niet gevonden");

  const activeCandidates = await listActiveCandidates(200);
  if (activeCandidates.length === 0) return [];

  const scored = activeCandidates.map((candidate) => ({
    candidate,
    ...computeMatchScore(job, candidate),
  }));
  scored.sort((a, b) => b.score - a.score);

  const topCandidates = scored.filter((s) => s.score >= MIN_SCORE).slice(0, TOP_N);
  if (topCandidates.length === 0) return [];

  const results = await Promise.all(
    topCandidates.map(async ({ candidate, score }): Promise<AutoMatchResult> => {
      let structuredResult: StructuredMatchOutput | null = null;

      try {
        structuredResult = await deepMatch(job, candidate);
      } catch (err) {
        console.error(`[Auto-Match] Deep match failed for candidate ${candidate.id}:`, err);
      }

      let judgeVerdict: JudgeVerdict | null = null;
      if (structuredResult) {
        try {
          judgeVerdict = await judgeMatch({
            jobTitle: job.title,
            candidateName: candidate.name,
            cvSummary: (candidate.resumeRaw ?? "").slice(0, 2000),
            structuredResult,
          });
        } catch (err) {
          console.error(`[Auto-Match] Judge failed for candidate ${candidate.id}:`, err);
        }
      }

      let matchId = "";
      let matchSaveError = false;
      try {
        matchId = await upsertMatch(job.id, candidate.id, score, structuredResult);
      } catch (err) {
        matchSaveError = true;
        console.error(`[Auto-Match] Create match failed for candidate ${candidate.id}:`, err);
      }

      // Slack notification for successful match (fire-and-forget)
      if (matchId && !matchSaveError) {
        notifySlack("match:created", {
          candidateName: candidate.name,
          jobTitle: job.title,
          company: job.company,
          matchScore: structuredResult?.overallScore ?? score,
          recommendation: structuredResult?.recommendation,
          matchId,
        });
      }

      return {
        jobId: job.id,
        jobTitle: job.title,
        company: job.company,
        location: job.location,
        candidateId: candidate.id,
        candidateName: candidate.name,
        quickScore: score,
        structuredResult,
        judgeVerdict,
        matchId,
        matchSaveError,
      };
    }),
  );

  return results;
}
