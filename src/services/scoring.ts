import type { Job } from "./jobs";
import type { Candidate } from "./candidates";

// ========== Types ==========

export type MatchResult = {
  score: number;
  confidence: number;
  reasoning: string;
};

// ========== Scoring Algorithm ==========

/**
 * Rule-based matching: kandidaat vs opdracht.
 * Maximaal 100 punten verdeeld over 4 dimensies:
 *   - Skills overlap:    0-40
 *   - Locatie match:     0-20
 *   - Tarief passend:    0-20
 *   - Rol aansluiting:   0-20
 */
export function computeMatchScore(job: Job, candidate: Candidate): MatchResult {
  let score = 0;
  const reasons: string[] = [];

  // ── 1. Skills overlap (0-40) ───────────────────────────────────
  const jobKeywords = extractKeywords(job);
  const candidateSkills = (candidate.skills as string[]) || [];

  const overlap = candidateSkills.filter((s) =>
    jobKeywords.some(
      (k) =>
        k.toLowerCase().includes(s.toLowerCase()) ||
        s.toLowerCase().includes(k.toLowerCase()),
    ),
  );

  const skillScore = Math.min(
    40,
    Math.round((overlap.length / Math.max(jobKeywords.length, 1)) * 40),
  );
  score += skillScore;

  if (overlap.length > 0) {
    reasons.push(
      `${overlap.length} skills match: ${overlap.slice(0, 3).join(", ")}`,
    );
  }

  // ── 2. Location match (0-20) ───────────────────────────────────
  if (
    candidate.province &&
    job.province &&
    candidate.province.toLowerCase() === job.province.toLowerCase()
  ) {
    score += 20;
    reasons.push("Provincie match");
  } else if (candidate.location && job.location) {
    const candidateCity = candidate.location.split(" - ")[0]?.toLowerCase();
    const jobCity = job.location?.split(" - ")[0]?.toLowerCase();
    if (candidateCity && jobCity && candidateCity === jobCity) {
      score += 15;
      reasons.push("Stad match");
    }
  }

  // ── 3. Rate fit (0-20) ────────────────────────────────────────
  if (candidate.hourlyRate && job.rateMax) {
    if (candidate.hourlyRate <= job.rateMax) {
      score += 20;
      reasons.push("Tarief past binnen budget");
    } else if (candidate.hourlyRate <= job.rateMax * 1.1) {
      score += 10;
      reasons.push("Tarief iets boven budget");
    }
  }

  // ── 4. Role alignment (0-20) ──────────────────────────────────
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
      score += Math.min(20, roleOverlap.length * 10);
      reasons.push("Rol sluit aan bij functietitel");
    }
  }

  return {
    score: Math.round(Math.min(100, score)),
    confidence: Math.round(Math.min(100, score * 1.2)),
    reasoning:
      reasons.join("; ") || "Geen specifieke match criteria gevonden",
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
      keywords.push(
        ...r.description.split(/\s+/).filter((w) => w.length > 3),
      );
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
