import type { Candidate } from "./candidates";
import type { Job } from "./jobs";

// ========== Types ==========

export type MatchResult = {
  score: number;
  confidence: number;
  reasoning: string;
  model: string;
};

// ========== Scoring Config ==========

/** Scoring rubric weights — total must equal 100 */
export const SCORING_WEIGHTS = {
  skills: 40,
  location: 20,
  rate: 20,
  role: 20,
} as const;

/** When embeddings are available, blend rule-based and vector scores */
export const HYBRID_BLEND = {
  ruleWeight: 0.6,
  vectorWeight: 0.4,
} as const;

// ========== Vector Math ==========

/**
 * Cosine similarity between two vectors. Returns 0-1.
 * Both vectors must have the same length and non-zero magnitude.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ========== Hybrid Scoring ==========

/**
 * Hybrid matching: combines rule-based scoring with vector similarity.
 *
 * When both job and candidate have embeddings:
 *   finalScore = 0.6 × ruleScore + 0.4 × (cosineSim × 100)
 *
 * When embeddings are missing, falls back to 100% rule-based.
 */
export function computeMatchScore(job: Job, candidate: Candidate): MatchResult {
  const ruleResult = computeRuleScore(job, candidate);
  const reasons = [ruleResult.reasoning];

  const jobEmbedding = job.embedding as number[] | null;
  const candidateEmbedding = candidate.embedding as number[] | null;

  // If both embeddings exist, compute hybrid score
  if (jobEmbedding?.length && candidateEmbedding?.length) {
    const similarity = cosineSimilarity(jobEmbedding, candidateEmbedding);
    const vectorScore = Math.round(similarity * 100);
    const blended = Math.round(
      HYBRID_BLEND.ruleWeight * ruleResult.score + HYBRID_BLEND.vectorWeight * vectorScore,
    );

    reasons.push(`Semantische match: ${vectorScore}%`);

    return {
      score: Math.min(100, blended),
      confidence: Math.round(Math.min(100, blended * 1.1)),
      reasoning: reasons.join("; "),
      model: "hybrid-v1",
    };
  }

  return {
    ...ruleResult,
    model: "rule-based-v1",
  };
}

// ========== Rule-Based Scoring ==========

/**
 * Rule-based matching: kandidaat vs opdracht.
 * Maximaal 100 punten verdeeld over 4 dimensies:
 *   - Skills overlap:    0-{SCORING_WEIGHTS.skills}
 *   - Locatie match:     0-{SCORING_WEIGHTS.location}
 *   - Tarief passend:    0-{SCORING_WEIGHTS.rate}
 *   - Rol aansluiting:   0-{SCORING_WEIGHTS.role}
 */
function computeRuleScore(job: Job, candidate: Candidate): Omit<MatchResult, "model"> {
  let score = 0;
  const reasons: string[] = [];

  // ── 1. Skills overlap (0-SCORING_WEIGHTS.skills) ──────────────────────────
  const jobKeywords = extractKeywords(job);
  const candidateSkills = (candidate.skills as string[]) || [];

  const overlap = candidateSkills.filter((s) =>
    jobKeywords.some(
      (k) => k.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(k.toLowerCase()),
    ),
  );

  const skillScore =
    jobKeywords.length > 0
      ? Math.min(
          SCORING_WEIGHTS.skills,
          Math.round((overlap.length / jobKeywords.length) * SCORING_WEIGHTS.skills),
        )
      : 0;
  score += skillScore;

  if (overlap.length > 0) {
    reasons.push(`${overlap.length} skills match: ${overlap.slice(0, 3).join(", ")}`);
  }

  // ── 2. Location match (0-SCORING_WEIGHTS.location) ────────────────────────
  if (
    candidate.province &&
    job.province &&
    candidate.province.toLowerCase() === job.province.toLowerCase()
  ) {
    score += SCORING_WEIGHTS.location;
    reasons.push("Provincie match");
  } else if (candidate.location && job.location) {
    const candidateCity = candidate.location.split(" - ")[0]?.toLowerCase();
    const jobCity = job.location?.split(" - ")[0]?.toLowerCase();
    if (candidateCity && jobCity && candidateCity === jobCity) {
      score += SCORING_WEIGHTS.location * 0.75;
      reasons.push("Stad match");
    }
  }

  // ── 3. Rate fit (0-SCORING_WEIGHTS.rate) ────────────────────────────────
  if (candidate.hourlyRate && job.rateMax) {
    if (candidate.hourlyRate <= job.rateMax) {
      score += SCORING_WEIGHTS.rate;
      reasons.push("Tarief past binnen budget");
    } else if (candidate.hourlyRate <= job.rateMax * 1.1) {
      score += SCORING_WEIGHTS.rate * 0.5;
      reasons.push("Tarief iets boven budget");
    }
  }

  // ── 4. Role alignment (0-SCORING_WEIGHTS.role) ──────────────────────────
  if (candidate.role && job.title) {
    const roleWords = candidate.role
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);
    const titleWords = job.title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const roleOverlap = roleWords.filter((w) =>
      titleWords.some((t) => t.includes(w) || w.includes(t)),
    );

    if (roleOverlap.length > 0) {
      score += Math.min(SCORING_WEIGHTS.role, roleOverlap.length * 10);
      reasons.push("Rol sluit aan bij functietitel");
    }
  }

  return {
    score: Math.round(Math.min(100, score)),
    confidence: Math.round(Math.min(100, score * 1.2)),
    reasoning: reasons.join("; ") || "Geen specifieke match criteria gevonden",
  };
}

// ========== Keyword Extraction ==========

/** Extract zoektermen uit opdracht requirements en competences. */
export function extractKeywords(job: Job): string[] {
  const keywords: string[] = [];

  // Requirements: array of { description: string }
  const reqs = (job.requirements as Array<{ description?: string }>) || [];
  for (const r of reqs) {
    if (r.description) {
      keywords.push(...r.description.split(/\s+/).filter((w) => w.length > 3));
    }
  }

  // Competences: string[]
  const comps = (job.competences as string[]) || [];
  keywords.push(...comps);

  // Deduplicate (case-insensitive)
  const seen = new Set<string>();
  return keywords.filter((k) => {
    const lower = k.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}
