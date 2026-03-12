import type { Candidate } from "./candidates";
import type { CandidateCanonicalSkill, JobCanonicalSkill } from "./esco";
import { isEscoScoringEnabled } from "./esco";
import { computeEscoSkillScore } from "./esco-scoring";
import type { Job } from "./jobs";

export type MatchResult = {
  score: number;
  confidence: number;
  reasoning: string;
  model: string;
};

export type EscoMatchOptions = {
  candidateEscoSkills: CandidateCanonicalSkill[];
  jobEscoSkills: JobCanonicalSkill[];
};

export const SCORING_WEIGHTS = {
  skills: 40,
  location: 20,
  rate: 20,
  role: 20,
} as const;

export const HYBRID_BLEND = {
  ruleWeight: 0.6,
  vectorWeight: 0.4,
} as const;

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

function isEscoScoringPathEnabled(options?: EscoMatchOptions): boolean {
  const envFlag =
    process.env.USE_ESCO_SCORING === "true" ||
    process.env.USE_ESCO_SCORING === "1" ||
    (typeof process.env.USE_ESCO_SCORING === "string" && process.env.USE_ESCO_SCORING.length > 0);
  return Boolean(
    (envFlag || isEscoScoringEnabled()) &&
      options?.candidateEscoSkills != null &&
      options?.jobEscoSkills != null,
  );
}

type SkillDimensionResult = {
  score: number;
  reasoning: string | null;
  usedEsco: boolean;
  guardrailFallback: boolean;
  /** When ESCO path was used but guardrail triggered; append to match reasoning. */
  escoReasoning?: string;
  /** True when ESCO path was attempted (used for model label). */
  escoPathUsed?: boolean;
};

function computeLegacySkillDimension(
  job: Job,
  candidate: Candidate,
): {
  score: number;
  overlap: string[];
} {
  const jobKeywords = extractKeywords(job);
  const candidateSkills = (candidate.skills as string[]) || [];

  const overlap = candidateSkills.filter((skill) =>
    jobKeywords.some(
      (keyword) =>
        keyword.toLowerCase().includes(skill.toLowerCase()) ||
        skill.toLowerCase().includes(keyword.toLowerCase()),
    ),
  );

  const score =
    jobKeywords.length > 0
      ? Math.min(
          SCORING_WEIGHTS.skills,
          Math.round((overlap.length / jobKeywords.length) * SCORING_WEIGHTS.skills),
        )
      : 0;

  return { score, overlap };
}

function logEscoGuardrailFallback(job: Job, candidate: Candidate, reasoning: string) {
  console.info("[ESCO] guardrail_fallback", {
    jobId: job.id,
    candidateId: candidate.id,
    reasoning,
  });
}

function computeSkillDimension(
  job: Job,
  candidate: Candidate,
  options?: EscoMatchOptions,
): SkillDimensionResult {
  if (isEscoScoringPathEnabled(options)) {
    const candidateEscoSkills = options?.candidateEscoSkills ?? [];
    const jobEscoSkills = options?.jobEscoSkills ?? [];
    const escoResult = computeEscoSkillScore(candidateEscoSkills, jobEscoSkills);
    if (!escoResult.guardrailFallback) {
      return {
        score: escoResult.skillScore,
        reasoning: escoResult.reasoning,
        usedEsco: true,
        guardrailFallback: false,
        escoPathUsed: true,
      };
    }
    // Guardrail fallback: use rule-based skill dimension and append ESCO reasoning
    const legacy = computeLegacySkillDimension(job, candidate);
    logEscoGuardrailFallback(job, candidate, escoResult.reasoning);
    return {
      score: legacy.score,
      reasoning:
        legacy.overlap.length > 0
          ? `${legacy.overlap.length} skills match: ${legacy.overlap.slice(0, 3).join(", ")}`
          : null,
      usedEsco: false,
      guardrailFallback: true,
      escoReasoning: escoResult.reasoning,
      escoPathUsed: true,
    };
  }

  const legacy = computeLegacySkillDimension(job, candidate);
  return {
    score: legacy.score,
    reasoning:
      legacy.overlap.length > 0
        ? `${legacy.overlap.length} skills match: ${legacy.overlap.slice(0, 3).join(", ")}`
        : null,
    usedEsco: false,
    guardrailFallback: false,
  };
}

function computeRuleScore(
  job: Job,
  candidate: Candidate,
  skillDimension: SkillDimensionResult,
): Omit<MatchResult, "model"> {
  let score = 0;
  const reasons: string[] = [];

  score += Math.min(SCORING_WEIGHTS.skills, Math.max(0, Math.round(skillDimension.score)));
  if (skillDimension.reasoning) {
    reasons.push(skillDimension.reasoning);
  }
  if (skillDimension.escoReasoning) {
    reasons.push(skillDimension.escoReasoning);
  }

  if (
    candidate.province &&
    job.province &&
    candidate.province.toLowerCase() === job.province.toLowerCase()
  ) {
    score += SCORING_WEIGHTS.location;
    reasons.push("Provincie match");
  } else if (candidate.location && job.location) {
    const candidateCity = candidate.location.split(" - ")[0]?.toLowerCase();
    const jobCity = job.location.split(" - ")[0]?.toLowerCase();
    if (candidateCity && jobCity && candidateCity === jobCity) {
      score += SCORING_WEIGHTS.location * 0.75;
      reasons.push("Stad match");
    }
  }

  if (candidate.hourlyRate && job.rateMax) {
    if (candidate.hourlyRate <= job.rateMax) {
      score += SCORING_WEIGHTS.rate;
      reasons.push("Tarief past binnen budget");
    } else if (candidate.hourlyRate <= job.rateMax * 1.1) {
      score += SCORING_WEIGHTS.rate * 0.5;
      reasons.push("Tarief iets boven budget");
    }
  }

  if (candidate.role && job.title) {
    const roleWords = candidate.role
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2);
    const titleWords = job.title
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2);

    const roleOverlap = roleWords.filter((word) =>
      titleWords.some((titleWord) => titleWord.includes(word) || word.includes(titleWord)),
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

export function computeMatchScore(
  job: Job,
  candidate: Candidate,
  options?: EscoMatchOptions,
): MatchResult {
  const skillDimension = computeSkillDimension(job, candidate, options);
  const ruleResult = computeRuleScore(job, candidate, skillDimension);

  const jobEmbedding = job.embedding as number[] | null;
  const candidateEmbedding = candidate.embedding as number[] | null;

  if (jobEmbedding?.length && candidateEmbedding?.length) {
    const similarity = cosineSimilarity(jobEmbedding, candidateEmbedding);
    const vectorScore = Math.round(similarity * 100);
    const blended = Math.round(
      HYBRID_BLEND.ruleWeight * ruleResult.score + HYBRID_BLEND.vectorWeight * vectorScore,
    );

    return {
      score: Math.min(100, blended),
      confidence: Math.round(Math.min(100, blended * 1.1)),
      reasoning: `${ruleResult.reasoning}; Semantische match: ${vectorScore}%`,
      model: skillDimension.usedEsco ? "esco-hybrid-v1" : "hybrid-v1",
    };
  }

  return {
    ...ruleResult,
    model: skillDimension.usedEsco ? "esco-rule-v1" : "rule-based-v1",
  };
}

export function extractKeywords(job: Pick<Job, "requirements" | "competences">): string[] {
  const keywords: string[] = [];

  const requirements = (job.requirements as Array<{ description?: string }>) || [];
  for (const requirement of requirements) {
    if (requirement.description) {
      keywords.push(...requirement.description.split(/\s+/).filter((word) => word.length > 3));
    }
  }

  const competences = (job.competences as string[]) || [];
  keywords.push(...competences);

  const seen = new Set<string>();
  return keywords.filter((keyword) => {
    const lower = keyword.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}
