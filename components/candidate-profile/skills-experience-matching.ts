import type { ExperienceEntry, LinkedSkill } from "@/components/candidate-profile/employment-card";
import type { StructuredSkill, StructuredSkills } from "@/src/schemas/candidate-intelligence";

function matchesEvidenceText(value: string | undefined, evidence: string): boolean {
  const normalizedValue = value?.toLowerCase().trim() ?? "";
  if (normalizedValue.length < 3) return false;
  return evidence.includes(normalizedValue);
}

function toLinkedSkill(skill: StructuredSkill, variant: "hard" | "soft"): LinkedSkill {
  return { ...skill, variant };
}

export function matchSkillsToExperience(
  entry: ExperienceEntry,
  skills: StructuredSkills,
): LinkedSkill[] {
  const matched: LinkedSkill[] = [];

  const check = (skill: StructuredSkill, variant: "hard" | "soft") => {
    const evidence = skill.evidence.toLowerCase();
    const matchesCompany = matchesEvidenceText(entry.company, evidence);
    const matchesTitle = matchesEvidenceText(entry.title, evidence);

    if (matchesCompany || matchesTitle) {
      matched.push(toLinkedSkill(skill, variant));
    }
  };

  for (const skill of skills.hard) check(skill, "hard");
  for (const skill of skills.soft) check(skill, "soft");

  return matched;
}

export function entryMatchesSkill(
  entry: ExperienceEntry,
  skillName: string,
  skills: StructuredSkills,
): boolean {
  const skill = [...skills.hard, ...skills.soft].find((item) => item.name === skillName);
  if (!skill) return false;

  const evidence = skill.evidence.toLowerCase();
  return matchesEvidenceText(entry.company, evidence) || matchesEvidenceText(entry.title, evidence);
}
