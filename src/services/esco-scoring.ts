import type { CandidateCanonicalSkill, JobCanonicalSkill } from "./esco";

export const ESCO_SKILL_WEIGHT = 50;

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
      reasoning: "Geen skills opgegeven voor vacature",
    };
  }

  const candidateSkillIds = new Set(candidateSkills.map((skill) => skill.skillId));
  const mustSkills = jobSkills.filter((skill) => skill.importance === "must" || skill.required);
  const niceSkills = jobSkills.filter((skill) => !(skill.importance === "must" || skill.required));

  const matchedMust = mustSkills.filter((skill) => candidateSkillIds.has(skill.skillId));
  const matchedNice = niceSkills.filter((skill) => candidateSkillIds.has(skill.skillId));
  const missingMust = mustSkills.filter((skill) => !candidateSkillIds.has(skill.skillId));

  const weightedEarned = matchedMust.length * 1 + matchedNice.length * 0.35;
  const weightedTotal = mustSkills.length * 1 + niceSkills.length * 0.35;
  const ratio = weightedTotal > 0 ? weightedEarned / weightedTotal : 0;

  const skillScore = Math.round(Math.min(ESCO_SKILL_WEIGHT, ratio * ESCO_SKILL_WEIGHT));
  const reasoningParts = [`${matchedMust.length} van ${mustSkills.length} vereiste skills matchen`];

  if (matchedNice.length > 0) {
    reasoningParts.push(
      `${matchedNice.length} aanvullende skill${matchedNice.length === 1 ? "" : "s"} matchen`,
    );
  }

  if (missingMust.length > 0) {
    reasoningParts.push(
      `ontbreekt: ${missingMust
        .slice(0, 3)
        .map((skill) => skill.label ?? skill.slug)
        .join(", ")}`,
    );
  }

  return {
    skillScore,
    guardrailFallback: false,
    reasoning: reasoningParts.join("; "),
  };
}
