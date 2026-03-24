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

function loadScoringWeights() {
  return {
    skills: parseInt(process.env.SCORING_WEIGHT_SKILLS ?? "40", 10),
    location: parseInt(process.env.SCORING_WEIGHT_LOCATION ?? "20", 10),
    rate: parseInt(process.env.SCORING_WEIGHT_RATE ?? "20", 10),
    role: parseInt(process.env.SCORING_WEIGHT_ROLE ?? "20", 10),
  };
}

function loadHybridBlend() {
  return {
    ruleWeight: parseFloat(process.env.HYBRID_BLEND_RULE ?? "0.6"),
    vectorWeight: parseFloat(process.env.HYBRID_BLEND_VECTOR ?? "0.4"),
  };
}

function loadRecencyConfig() {
  return {
    boostDays: parseInt(process.env.RECENCY_BOOST_DAYS ?? "30", 10),
    penaltyDays: parseInt(process.env.RECENCY_PENALTY_DAYS ?? "60", 10),
    boostAmount: parseInt(process.env.RECENCY_BOOST_AMOUNT ?? "5", 10),
    penaltyAmount: parseInt(process.env.RECENCY_PENALTY_AMOUNT ?? "5", 10),
  };
}

function loadQualityConfig() {
  return {
    decayDays: parseInt(process.env.QUALITY_SIGNAL_DECAY_DAYS ?? "90", 10),
    highApprovalThreshold: parseInt(process.env.QUALITY_HIGH_APPROVAL_THRESHOLD ?? "70", 10),
    lowApprovalThreshold: parseInt(process.env.QUALITY_LOW_APPROVAL_THRESHOLD ?? "30", 10),
    highApprovalBoost: parseInt(process.env.QUALITY_HIGH_APPROVAL_BOOST ?? "5", 10),
    lowApprovalPenalty: parseInt(process.env.QUALITY_LOW_APPROVAL_PENALTY ?? "5", 10),
    minDecisions: parseInt(process.env.QUALITY_MIN_DECISIONS ?? "3", 10),
  };
}

export const SCORING_WEIGHTS = loadScoringWeights();
export const HYBRID_BLEND = loadHybridBlend();
export const RECENCY_CONFIG = loadRecencyConfig();
export const QUALITY_CONFIG = loadQualityConfig();

export type RecencyResult = {
  adjustment: number;
  reasoning: string | null;
};

export type QualityResult = {
  adjustment: number;
  reasoning: string | null;
  approvalRate: number | null;
  totalDecisions: number;
};

export type MatchDecision = {
  status: string;
  reviewedAt: Date | null;
};

/**
 * Calculate recency-based score adjustment based on candidate's lastMatchedAt timestamp.
 * Boosts recently matched candidates (≤ boostDays) and penalizes stale candidates (> penaltyDays).
 * Null lastMatchedAt results in neutral scoring (no adjustment).
 */
export function computeRecencyScore(lastMatchedAt: Date | null | undefined): RecencyResult {
  const config = RECENCY_CONFIG;

  // Null or undefined lastMatchedAt = neutral scoring
  if (!lastMatchedAt) {
    return { adjustment: 0, reasoning: null };
  }

  const now = new Date();
  const lastMatch = new Date(lastMatchedAt);
  const daysSinceMatch = (now.getTime() - lastMatch.getTime()) / (1000 * 60 * 60 * 24);

  // Recent match within boost window → positive boost
  if (daysSinceMatch <= config.boostDays) {
    return {
      adjustment: config.boostAmount,
      reasoning: `Recente match (${Math.round(daysSinceMatch)} dagen geleden)`,
    };
  }

  // Stale match beyond penalty window → negative penalty
  if (daysSinceMatch > config.penaltyDays) {
    return {
      adjustment: -config.penaltyAmount,
      reasoning: `Verouderde match (${Math.round(daysSinceMatch)} dagen geleden)`,
    };
  }

  // Between boost and penalty window → neutral
  return { adjustment: 0, reasoning: null };
}

/**
 * Calculate quality-based score adjustment from candidate's match history.
 * Approval rate = approved / (approved + rejected) from jobMatches.
 * Boosts candidates with ≥70% approval rate (+5 points).
 * Penalizes candidates with <30% approval rate (-5 points).
 * Requires minimum 3 decisions before applying signal.
 * Only considers matches from last 90 days (configurable via QUALITY_SIGNAL_DECAY_DAYS).
 * New candidates (no history) receive neutral quality signal.
 */
export function computeQualityScore(
  decisions: MatchDecision[],
  now: Date = new Date(),
): QualityResult {
  const config = QUALITY_CONFIG;

  // No decisions = neutral for new candidates
  if (!decisions || decisions.length === 0) {
    return {
      adjustment: 0,
      reasoning: null,
      approvalRate: null,
      totalDecisions: 0,
    };
  }

  // Filter to only approved/rejected decisions within decay window
  const cutoffDate = new Date(now.getTime() - config.decayDays * 24 * 60 * 60 * 1000);
  const relevantDecisions = decisions.filter(
    (d) =>
      (d.status === "approved" || d.status === "rejected") &&
      d.reviewedAt &&
      new Date(d.reviewedAt) >= cutoffDate,
  );

  const approvedCount = relevantDecisions.filter((d) => d.status === "approved").length;
  const rejectedCount = relevantDecisions.filter((d) => d.status === "rejected").length;
  const totalDecisions = approvedCount + rejectedCount;

  // Not enough decisions = neutral
  if (totalDecisions < config.minDecisions) {
    return {
      adjustment: 0,
      reasoning: null,
      approvalRate: totalDecisions > 0 ? approvedCount / totalDecisions : null,
      totalDecisions,
    };
  }

  const approvalRate = approvedCount / totalDecisions;
  const approvalPercent = Math.round(approvalRate * 100);

  // High approval rate → boost
  if (approvalPercent >= config.highApprovalThreshold) {
    return {
      adjustment: config.highApprovalBoost,
      reasoning: `Hoge goedkeuring (${approvalPercent}% van ${totalDecisions} matches)`,
      approvalRate,
      totalDecisions,
    };
  }

  // Low approval rate → penalty
  if (approvalPercent < config.lowApprovalThreshold) {
    return {
      adjustment: -config.lowApprovalPenalty,
      reasoning: `Lage goedkeuring (${approvalPercent}% van ${totalDecisions} matches)`,
      approvalRate,
      totalDecisions,
    };
  }

  // Medium approval rate → neutral
  return {
    adjustment: 0,
    reasoning: null,
    approvalRate,
    totalDecisions,
  };
}

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
  const hasJobEscoSkills =
    Array.isArray(options?.jobEscoSkills) && options.jobEscoSkills.length > 0;
  return Boolean(
    (envFlag || isEscoScoringEnabled()) &&
      hasJobEscoSkills &&
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
  skillsWeight: number = SCORING_WEIGHTS.skills,
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
      ? Math.min(skillsWeight, Math.round((overlap.length / jobKeywords.length) * skillsWeight))
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
  skillsWeight?: number,
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
    const legacy = computeLegacySkillDimension(job, candidate, skillsWeight);
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

  const legacy = computeLegacySkillDimension(job, candidate, skillsWeight);
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
  weights: typeof SCORING_WEIGHTS,
): Omit<MatchResult, "model"> {
  let score = 0;
  const reasons: string[] = [];

  score += Math.min(weights.skills, Math.max(0, Math.round(skillDimension.score)));
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
    score += weights.location;
    reasons.push("Provincie match");
  } else if (candidate.location && job.location) {
    const candidateCity = candidate.location.split(" - ")[0]?.toLowerCase();
    const jobCity = job.location.split(" - ")[0]?.toLowerCase();
    if (candidateCity && jobCity && candidateCity === jobCity) {
      score += weights.location * 0.75;
      reasons.push("Stad match");
    }
  }

  if (candidate.hourlyRate && job.rateMax) {
    if (candidate.hourlyRate <= job.rateMax) {
      score += weights.rate;
      reasons.push("Tarief past binnen budget");
    } else if (candidate.hourlyRate <= job.rateMax * 1.1) {
      score += weights.rate * 0.5;
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
      score += Math.min(weights.role, roleOverlap.length * 10);
      reasons.push("Rol sluit aan bij functietitel");
    }
  }

  return {
    score: Math.round(Math.min(100, score)),
    confidence: Math.round(Math.min(100, score * 1.2)),
    reasoning: reasons.join("; ") || "Geen specifieke match criteria gevonden",
  };
}

export type DynamicWeights = {
  /** Weight for skills matching (0-1, will be scaled to scoring weight) */
  skills?: number;
  /** Weight for location matching (0-1, will be scaled to scoring weight) */
  location?: number;
  /** Weight for rate matching (0-1, will be scaled to scoring weight) */
  rate?: number;
  /** Weight for role matching (0-1, will be scaled to scoring weight) */
  role?: number;
  /** Rule-based score weight in hybrid blend (0-1) */
  ruleWeight?: number;
  /** Vector similarity score weight in hybrid blend (0-1) */
  vectorWeight?: number;
};

export type ComputeMatchScoreOptions = EscoMatchOptions & {
  matchDecisions?: MatchDecision[];
  weights?: DynamicWeights;
};

/**
 * Validates dynamic weights are within valid range (0-1).
 * Throws error for invalid values (negative, >1, NaN).
 */
export function validateDynamicWeights(weights: DynamicWeights): void {
  const fields: (keyof DynamicWeights)[] = [
    "skills",
    "location",
    "rate",
    "role",
    "ruleWeight",
    "vectorWeight",
  ];

  for (const field of fields) {
    const value = weights[field];
    if (value === undefined) continue;

    if (Number.isNaN(value)) {
      throw new Error(`Invalid weight: ${field} is NaN`);
    }
    if (value < 0) {
      throw new Error(`Invalid weight: ${field} is negative (${value})`);
    }
    if (value > 1) {
      throw new Error(`Invalid weight: ${field} exceeds 1 (${value})`);
    }
  }
}

/**
 * Merges dynamic weights with default SCORING_WEIGHTS.
 * Returns effective weights for scoring calculation.
 */
function mergeScoringWeights(dynamicWeights?: DynamicWeights): typeof SCORING_WEIGHTS {
  if (!dynamicWeights) return SCORING_WEIGHTS;

  return {
    skills:
      dynamicWeights.skills !== undefined
        ? Math.round(dynamicWeights.skills * 100)
        : SCORING_WEIGHTS.skills,
    location:
      dynamicWeights.location !== undefined
        ? Math.round(dynamicWeights.location * 100)
        : SCORING_WEIGHTS.location,
    rate:
      dynamicWeights.rate !== undefined
        ? Math.round(dynamicWeights.rate * 100)
        : SCORING_WEIGHTS.rate,
    role:
      dynamicWeights.role !== undefined
        ? Math.round(dynamicWeights.role * 100)
        : SCORING_WEIGHTS.role,
  };
}

/**
 * Merges dynamic weights with default HYBRID_BLEND.
 * Returns effective blend weights for hybrid calculation.
 */
function mergeHybridBlend(dynamicWeights?: DynamicWeights): typeof HYBRID_BLEND {
  if (!dynamicWeights) return HYBRID_BLEND;

  const ruleWeight =
    dynamicWeights.ruleWeight !== undefined ? dynamicWeights.ruleWeight : HYBRID_BLEND.ruleWeight;
  const vectorWeight =
    dynamicWeights.vectorWeight !== undefined
      ? dynamicWeights.vectorWeight
      : HYBRID_BLEND.vectorWeight;

  return { ruleWeight, vectorWeight };
}

export function computeMatchScore(
  job: Job,
  candidate: Candidate,
  options?: ComputeMatchScoreOptions,
): MatchResult {
  // Validate dynamic weights if provided
  if (options?.weights) {
    validateDynamicWeights(options.weights);
  }

  // Merge dynamic weights with defaults
  const effectiveScoringWeights = mergeScoringWeights(options?.weights);
  const effectiveHybridBlend = mergeHybridBlend(options?.weights);

  const skillDimension = computeSkillDimension(
    job,
    candidate,
    options,
    effectiveScoringWeights.skills,
  );
  const ruleResult = computeRuleScore(job, candidate, skillDimension, effectiveScoringWeights);

  // Calculate recency adjustment based on candidate's last match
  const recencyResult = computeRecencyScore(candidate.lastMatchedAt);

  // Calculate quality adjustment based on candidate's match history
  const qualityResult = computeQualityScore(options?.matchDecisions ?? []);

  const jobEmbedding = job.embedding as number[] | null;
  const candidateEmbedding = candidate.embedding as number[] | null;

  let baseScore: number;
  const reasoningParts: string[] = [ruleResult.reasoning];

  if (jobEmbedding?.length && candidateEmbedding?.length) {
    const similarity = cosineSimilarity(jobEmbedding, candidateEmbedding);
    const vectorScore = Math.round(similarity * 100);
    baseScore = Math.round(
      effectiveHybridBlend.ruleWeight * ruleResult.score +
        effectiveHybridBlend.vectorWeight * vectorScore,
    );
    reasoningParts.push(`Semantische match: ${vectorScore}%`);
  } else {
    baseScore = ruleResult.score;
  }

  // Apply recency and quality adjustments, then cap to 0-100 range
  let finalScore = baseScore + recencyResult.adjustment + qualityResult.adjustment;
  finalScore = Math.max(0, Math.min(100, finalScore));

  // Add recency reasoning if applicable
  if (recencyResult.reasoning) {
    reasoningParts.push(recencyResult.reasoning);
  }

  // Add quality reasoning if applicable
  if (qualityResult.reasoning) {
    reasoningParts.push(qualityResult.reasoning);
  }

  // Determine model label
  let modelLabel: string;
  if (skillDimension.usedEsco) {
    modelLabel =
      jobEmbedding?.length && candidateEmbedding?.length ? "esco-hybrid-v1" : "esco-rule-v1";
  } else {
    modelLabel = jobEmbedding?.length && candidateEmbedding?.length ? "hybrid-v1" : "rule-based-v1";
  }

  return {
    score: Math.round(finalScore),
    confidence: Math.round(Math.min(100, finalScore * 1.1)),
    reasoning: reasoningParts.join("; "),
    model: modelLabel,
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
