import { describe, expect, it } from "vitest";

import { extractCandidateSkillSeeds, extractJobSkillSeeds } from "../src/services/esco-backfill.js";

describe("extractCandidateSkillSeeds", () => {
  it("deduplicates flat and structured candidate skills while keeping richer evidence", () => {
    const seeds = extractCandidateSkillSeeds({
      skills: ["React", "TypeScript", "react", "", "  "],
      skillsStructured: {
        hard: [
          { name: "React", proficiency: "advanced", evidence: "6 jaar frontend projecten" },
          { name: "Node.js", proficiency: "medior" },
        ],
        soft: [{ name: "Stakeholdermanagement", evidence: "Scrum lead" }],
      },
    });

    expect(seeds).toEqual([
      {
        rawSkill: "React",
        source: "candidate.skillsStructured.hard",
        confidenceHint: "structured",
        critical: false,
        evidence: "6 jaar frontend projecten",
      },
      {
        rawSkill: "TypeScript",
        source: "candidate.skills",
        confidenceHint: "legacy-flat",
        critical: false,
      },
      {
        rawSkill: "Node.js",
        source: "candidate.skillsStructured.hard",
        confidenceHint: "structured",
        critical: false,
      },
      {
        rawSkill: "Stakeholdermanagement",
        source: "candidate.skillsStructured.soft",
        confidenceHint: "structured",
        critical: false,
        evidence: "Scrum lead",
      },
    ]);
  });
});

describe("extractJobSkillSeeds", () => {
  it("combines requirements, wishes, and competences with criticality metadata", () => {
    const seeds = extractJobSkillSeeds({
      requirements: [
        { description: "React ervaring", isKnockout: true },
        { description: "TypeScript ervaring", isKnockout: false },
      ],
      wishes: [{ description: "Ervaring met GraphQL" }, "Design systems"],
      competences: ["Stakeholdermanagement", "react ervaring"],
    });

    expect(seeds).toEqual([
      {
        rawSkill: "React ervaring",
        source: "job.requirements",
        confidenceHint: "requirement",
        critical: true,
      },
      {
        rawSkill: "TypeScript ervaring",
        source: "job.requirements",
        confidenceHint: "requirement",
        critical: false,
      },
      {
        rawSkill: "Ervaring met GraphQL",
        source: "job.wishes",
        confidenceHint: "wish",
        critical: false,
      },
      {
        rawSkill: "Design systems",
        source: "job.wishes",
        confidenceHint: "wish",
        critical: false,
      },
      {
        rawSkill: "Stakeholdermanagement",
        source: "job.competences",
        confidenceHint: "competence",
        critical: false,
      },
    ]);
  });
});
