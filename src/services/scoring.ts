import type { Candidate } from "./candidates";
import type { Job } from "./jobs";

// ========== Types ==========

export type MatchResult = {
  score: number;
  confidence: number;
  reasoning: string;
};

// ========== Scoring Rubric ==========

/** Scoring rubric weights — total must equal 100 */
const WEIGHT_SKILLS = 40;
const WEIGHT_LOCATION = 20;
const WEIGHT_RATE = 20;
const WEIGHT_ROLE = 20;

// ========== Scoring Algorithm ==========

/**
 * Rule-based matching: kandidaat vs opdracht.
 * Maximaal 100 punten verdeeld over 4 dimensies:
 *   - Skills overlap:    0-{WEIGHT_SKILLS}
 *   - Locatie match:     0-{WEIGHT_LOCATION}
 *   - Tarief passend:    0-{WEIGHT_RATE}
 *   - Rol aansluiting:   0-{WEIGHT_ROLE}
 */
export function computeMatchScore(job: Job, candidate: Candidate): MatchResult {
  let score = 0;
  const reasons: string[] = [];

  // ── 1. Skills overlap (0-WEIGHT_SKILLS) ──────────────────────────
  const jobKeywords = extractKeywords(job);
  const candidateSkills = (candidate.skills as string[]) || [];

  const overlap = candidateSkills.filter((s) =>
    jobKeywords.some(
      (k) => k.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(k.toLowerCase()),
    ),
  );

  const skillScore =
    jobKeywords.length > 0
      ? Math.min(WEIGHT_SKILLS, Math.round((overlap.length / jobKeywords.length) * WEIGHT_SKILLS))
      : 0;
  score += skillScore;

  if (overlap.length > 0) {
    reasons.push(`${overlap.length} skills match: ${overlap.slice(0, 3).join(", ")}`);
  }

  // ── 2. Location match (0-WEIGHT_LOCATION) ────────────────────────
  if (
    candidate.province &&
    job.province &&
    candidate.province.toLowerCase() === job.province.toLowerCase()
  ) {
    score += WEIGHT_LOCATION;
    reasons.push("Provincie match");
  } else if (candidate.location && job.location) {
    const candidateCity = candidate.location.split(" - ")[0]?.toLowerCase();
    const jobCity = job.location?.split(" - ")[0]?.toLowerCase();
    if (candidateCity && jobCity && candidateCity === jobCity) {
      score += WEIGHT_LOCATION * 0.75;
      reasons.push("Stad match");
    }
  }

  // ── 3. Rate fit (0-WEIGHT_RATE) ────────────────────────────────
  if (candidate.hourlyRate && job.rateMax) {
    if (candidate.hourlyRate <= job.rateMax) {
      score += WEIGHT_RATE;
      reasons.push("Tarief past binnen budget");
    } else if (candidate.hourlyRate <= job.rateMax * 1.1) {
      score += WEIGHT_RATE * 0.5;
      reasons.push("Tarief iets boven budget");
    }
  }

  // ── 4. Role alignment (0-WEIGHT_ROLE) ──────────────────────────
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
      score += Math.min(WEIGHT_ROLE, roleOverlap.length * 10);
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
