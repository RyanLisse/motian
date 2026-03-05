import type { CandidateCanonicalSkill, JobCanonicalSkill } from "./esco";

const MIN_CONFIDENCE = Number(process.env.ESCO_SCORING_MIN_CONFIDENCE ?? "0.5");
/** Align with esco.ts CRITICAL_REVIEW_THRESHOLD default (0.7) when used for guardrail. */
const CRITICAL_REVIEW_THRESHOLD = Number(process.env.ESCO_CRITICAL_REVIEW_THRESHOLD ?? "0.7");

export const ESCO_SKILL_WEIGHT = 40;

export type EscoSkillScoreResult = {
  skillScore: number;
  guardrailFallback: boolean;
  reasoning: string;
};

export function computeEscoSkillScore(
  candidateSkills: CandidateCanonicalSkill[],
  jobSkills: JobCanonicalSkill[],
): EscoSkillScoreResult {
  if (jobSkills.length === 0) {
    return {
      skillScore: 0,
      guardrailFallback: false,
      reasoning: "Geen ESCO-vaardigheden voor opdracht",
    };
  }

  const lowConfidenceCritical = jobSkills.filter(
    (skill) => skill.critical && skill.confidence < CRITICAL_REVIEW_THRESHOLD,
  );
  if (lowConfidenceCritical.length > 0) {
    return {
      skillScore: 0,
      guardrailFallback: true,
      reasoning: `ESCO guardrail fallback: ${lowConfidenceCritical.length} kritieke skill(s) met lage confidence`,
    };
  }

  const candidateUris = new Set(
    candidateSkills
      .filter((skill) => skill.confidence >= MIN_CONFIDENCE)
      .map((skill) => skill.escoUri),
  );

  if (candidateUris.size === 0) {
    return {
      skillScore: 0,
      guardrailFallback: true,
      reasoning: "Geen ESCO-vaardigheden voor kandidaat; fallback naar legacy skill score",
    };
  }

  let earnedWeight = 0;
  let totalWeight = 0;
  const matched: string[] = [];
  const missingCritical: string[] = [];

  for (const jobSkill of jobSkills) {
    const baseWeight = jobSkill.weight ?? (jobSkill.critical ? 1.5 : jobSkill.required ? 1 : 0.6);
    totalWeight += baseWeight;

    if (candidateUris.has(jobSkill.escoUri)) {
      earnedWeight += baseWeight;
      matched.push(jobSkill.label ?? jobSkill.escoUri);
      continue;
    }

    if (jobSkill.critical) {
      missingCritical.push(jobSkill.label ?? jobSkill.escoUri);
    }
  }

  if (missingCritical.length > 0) {
    return {
      skillScore: 0,
      guardrailFallback: true,
      reasoning: `ESCO guardrail fallback: ontbrekende kritieke skill(s): ${missingCritical.join(", ")}`,
    };
  }

  const ratio = totalWeight > 0 ? earnedWeight / totalWeight : 0;
  return {
    skillScore: Math.round(Math.min(ESCO_SKILL_WEIGHT, ratio * ESCO_SKILL_WEIGHT)),
    guardrailFallback: false,
    reasoning:
      matched.length > 0
        ? `ESCO: ${matched.length} match(es) op ${matched.slice(0, 3).join(", ")}`
        : "Geen ESCO skill overlap",
  };
}
