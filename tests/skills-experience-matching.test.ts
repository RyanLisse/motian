import { describe, expect, it } from "vitest";
import {
  entryMatchesSkill,
  matchSkillsToExperience,
} from "../components/candidate-profile/skills-experience-matching";
import type { StructuredSkills } from "../src/schemas/candidate-intelligence";

const skills: StructuredSkills = {
  hard: [
    {
      name: "React",
      proficiency: 4,
      evidence:
        "Gebruikte React dagelijks als Frontend Developer bij Acme om dashboards te bouwen.",
    },
  ],
  soft: [
    {
      name: "Stakeholdermanagement",
      proficiency: 4,
      evidence: "Als Frontend Developer bij Acme stemde kandidaat continu af met stakeholders.",
    },
  ],
};

const emptySkills: StructuredSkills = { hard: [], soft: [] };

describe("skills experience matching", () => {
  it("links skills to an experience entry via evidence on company or title", () => {
    const result = matchSkillsToExperience(
      {
        company: "Acme",
        title: "Frontend Developer",
      },
      skills,
    );

    expect(result.map((skill) => skill.name)).toEqual(["React", "Stakeholdermanagement"]);
  });

  it("returns false when a selected skill is not evidenced by the experience entry", () => {
    const result = entryMatchesSkill(
      {
        company: "Globex",
        title: "Projectmanager",
      },
      "React",
      skills,
    );

    expect(result).toBe(false);
  });

  it("returns true when entryMatchesSkill finds evidence for the experience", () => {
    const result = entryMatchesSkill(
      {
        company: "Acme",
        title: "Frontend Developer",
      },
      "React",
      skills,
    );

    expect(result).toBe(true);
  });

  it("returns empty array when skills are empty", () => {
    const result = matchSkillsToExperience({ company: "Acme", title: "Developer" }, emptySkills);
    expect(result).toEqual([]);
  });

  it("returns empty array when entry has no company or title", () => {
    const result = matchSkillsToExperience({}, skills);
    expect(result).toEqual([]);
  });

  it("returns false for unknown skill name", () => {
    const result = entryMatchesSkill(
      { company: "Acme", title: "Developer" },
      "NonExistentSkill",
      skills,
    );
    expect(result).toBe(false);
  });

  it("matches case-insensitively", () => {
    const result = matchSkillsToExperience(
      { company: "ACME", title: "frontend developer" },
      skills,
    );
    expect(result.map((s) => s.name)).toEqual(["React", "Stakeholdermanagement"]);
  });

  it("ignores very short company/title values (< 3 chars)", () => {
    const result = matchSkillsToExperience({ company: "AB", title: "FD" }, skills);
    expect(result).toEqual([]);
  });

  it("preserves variant (hard/soft) on linked skills", () => {
    const result = matchSkillsToExperience(
      { company: "Acme", title: "Frontend Developer" },
      skills,
    );
    expect(result[0].variant).toBe("hard");
    expect(result[1].variant).toBe("soft");
  });
});
