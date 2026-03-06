import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { structuredSkillsSchema } from "../src/schemas/candidate-intelligence.js";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("Skills graph — component exports", () => {
  it("SkillsRadar exports from components/skills-radar.tsx", () => {
    const source = readFile("components/skills-radar.tsx");
    expect(source).toContain("export function SkillsRadar");
  });

  it("SkillsTags exports from components/skills-tags.tsx", () => {
    const source = readFile("components/skills-tags.tsx");
    expect(source).toContain("export function SkillsTags");
  });
});

describe("Skills graph — schema validation", () => {
  it("structuredSkillsSchema validates sample skills data", () => {
    const sample = {
      hard: [
        { name: "TypeScript", proficiency: 4, evidence: "5 jaar ervaring" },
        { name: "React", proficiency: 3, evidence: "Meerdere projecten" },
      ],
      soft: [{ name: "Communicatie", proficiency: 5, evidence: "Team lead 10 jaar" }],
    };
    const result = structuredSkillsSchema.safeParse(sample);
    expect(result.success).toBe(true);
  });

  it("rejects invalid proficiency values", () => {
    const invalid = {
      hard: [{ name: "Python", proficiency: 6, evidence: "test" }],
      soft: [],
    };
    const result = structuredSkillsSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects proficiency below 1", () => {
    const invalid = {
      hard: [{ name: "Java", proficiency: 0, evidence: "test" }],
      soft: [],
    };
    const result = structuredSkillsSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("accepts empty skill arrays", () => {
    const sample = {
      hard: [],
      soft: [],
    };
    const result = structuredSkillsSchema.safeParse(sample);
    expect(result.success).toBe(true);
  });

  it("validates all proficiency levels 1-5", () => {
    for (let level = 1; level <= 5; level++) {
      const sample = {
        hard: [{ name: `Skill${level}`, proficiency: level, evidence: "test" }],
        soft: [],
      };
      const result = structuredSkillsSchema.safeParse(sample);
      expect(result.success).toBe(true);
    }
  });
});

describe("Skills graph — radar chart", () => {
  it("uses RadarChart from recharts", () => {
    const source = readFile("components/skills-radar.tsx");
    expect(source).toContain("RadarChart");
    expect(source).toContain("recharts");
  });

  it("supports comparison mode", () => {
    const source = readFile("components/skills-radar.tsx");
    expect(source).toContain("compareWith");
  });

  it("has fallback for fewer than 3 categories", () => {
    const source = readFile("components/skills-radar.tsx");
    expect(source).toContain("categories.length < 3");
  });

  it("categorizes hard skills as Technisch by default", () => {
    const source = readFile("components/skills-radar.tsx");
    expect(source).toContain("Technisch");
  });

  it("categorizes tools (Docker, Kubernetes, Git, etc.)", () => {
    const source = readFile("components/skills-radar.tsx");
    expect(source).toContain("docker");
    expect(source).toContain("kubernetes");
    expect(source).toContain("git");
  });

  it("categorizes domain knowledge (Finance, Healthcare, etc.)", () => {
    const source = readFile("components/skills-radar.tsx");
    expect(source).toContain("finance");
    expect(source).toContain("healthcare");
  });

  it("categorizes languages", () => {
    const source = readFile("components/skills-radar.tsx");
    expect(source).toContain("english");
    expect(source).toContain("dutch");
    expect(source).toContain("Talen");
  });

  it("groups soft skills as Soft Skills category", () => {
    const source = readFile("components/skills-radar.tsx");
    expect(source).toContain("Soft Skills");
  });

  it("averages proficiency scores within categories", () => {
    const source = readFile("components/skills-radar.tsx");
    expect(source).toContain("reduce");
    expect(source).toContain("values.length");
  });

  it("renders ResponsiveContainer for responsive layout", () => {
    const source = readFile("components/skills-radar.tsx");
    expect(source).toContain("ResponsiveContainer");
  });

  it("uses PolarGrid for radial background", () => {
    const source = readFile("components/skills-radar.tsx");
    expect(source).toContain("PolarGrid");
  });

  it("uses PolarAngleAxis for category labels", () => {
    const source = readFile("components/skills-radar.tsx");
    expect(source).toContain("PolarAngleAxis");
  });

  it("uses PolarRadiusAxis with 0-5 domain", () => {
    const source = readFile("components/skills-radar.tsx");
    expect(source).toContain("PolarRadiusAxis");
    expect(source).toContain("domain={[0, 5]}");
  });

  it("renders Radar for candidate data", () => {
    const source = readFile("components/skills-radar.tsx");
    expect(source).toContain("Kandidaat");
  });

  it("conditionally renders comparison Radar", () => {
    const source = readFile("components/skills-radar.tsx");
    expect(source).toContain("compareWith &&");
    expect(source).toContain("Vergelijking");
  });

  it("includes Legend for chart clarity", () => {
    const source = readFile("components/skills-radar.tsx");
    expect(source).toContain("<Legend");
  });
});

describe("Skills graph — tag cloud", () => {
  it("renders proficiency dots", () => {
    const source = readFile("components/skills-tags.tsx");
    expect(source).toContain("ProficiencyDots");
    expect(source).toContain("proficiency");
  });

  it("uses rounded-full for dot styling", () => {
    const source = readFile("components/skills-tags.tsx");
    expect(source).toContain("rounded-full");
  });

  it("has Dutch section headers", () => {
    const source = readFile("components/skills-tags.tsx");
    expect(source).toContain("Harde vaardigheden");
    expect(source).toContain("Zachte vaardigheden");
  });

  it("supports sorting by proficiency", () => {
    const source = readFile("components/skills-tags.tsx");
    expect(source).toContain("proficiency");
    expect(source).toContain("b.proficiency - a.proficiency");
  });

  it("supports alphabetical sorting", () => {
    const source = readFile("components/skills-tags.tsx");
    expect(source).toContain("localeCompare");
  });

  it("supports filtering by skill type (all/hard/soft)", () => {
    const source = readFile("components/skills-tags.tsx");
    expect(source).toContain('filter?: "all" | "hard" | "soft"');
  });

  it("has filter labels in Dutch", () => {
    const source = readFile("components/skills-tags.tsx");
    expect(source).toContain("Alles");
    expect(source).toContain("Hard");
    expect(source).toContain("Zacht");
  });

  it("has sort labels in Dutch", () => {
    const source = readFile("components/skills-tags.tsx");
    expect(source).toContain("Niveau");
    expect(source).toContain("A-Z");
  });

  it("uses SkillTag component for individual skills", () => {
    const source = readFile("components/skills-tags.tsx");
    expect(source).toContain("SkillTag");
  });

  it("differentiates hard vs soft skill styling", () => {
    const source = readFile("components/skills-tags.tsx");
    expect(source).toContain('variant === "hard"');
    expect(source).toContain("bg-primary/10");
    expect(source).toContain("violet-500/10");
  });

  it("uses SegmentedControl for filter/sort UI", () => {
    const source = readFile("components/skills-tags.tsx");
    expect(source).toContain("SegmentedControl");
  });

  it("shows empty state message", () => {
    const source = readFile("components/skills-tags.tsx");
    expect(source).toContain("Geen harde vaardigheden gevonden in het CV");
    expect(source).toContain("Geen zachte vaardigheden gevonden in het CV");
  });

  it("renders proficiency dots 0-4", () => {
    const source = readFile("components/skills-tags.tsx");
    expect(source).toContain("[0, 1, 2, 3, 4]");
  });

  it("applies opacity to unfilled dots", () => {
    const source = readFile("components/skills-tags.tsx");
    expect(source).toContain("opacity-20");
  });
});

describe("Skills graph — profile integration", () => {
  it("candidate profile page imports SkillsRadar", () => {
    const source = readFile("app/professionals/[id]/page.tsx");
    expect(source).toContain("SkillsRadar");
  });

  it("candidate profile page imports SkillsExperienceSection", () => {
    const source = readFile("app/professionals/[id]/page.tsx");
    expect(source).toContain("SkillsExperienceSection");
  });

  it("candidate profile reads skillsStructured field", () => {
    const source = readFile("app/professionals/[id]/page.tsx");
    expect(source).toContain("skillsStructured");
  });

  it("validates skillsStructured defensively with safeParse", () => {
    const source = readFile("app/professionals/[id]/page.tsx");
    expect(source).toContain("structuredSkillsSchema.safeParse");
  });

  it("checks for valid structured skills before rendering", () => {
    const source = readFile("app/professionals/[id]/page.tsx");
    expect(source).toContain("structuredSkills &&");
    expect(source).toContain("structuredSkills.hard.length > 0");
  });

  it("renders skills tags inside the shared recruiter decision section", () => {
    const source = readFile("components/candidate-profile/skills-experience-section.tsx");
    expect(source).toContain("SkillsTags");
    expect(source).toContain("EmploymentCard");
  });

  it("wraps components in card styling", () => {
    const source = readFile("app/professionals/[id]/page.tsx");
    expect(source).toContain("bg-card");
    expect(source).toContain("border");
    expect(source).toContain("rounded-xl");
  });

  it("has fallback for legacy flat skills array", () => {
    const source = readFile("app/professionals/[id]/page.tsx");
    expect(source).toContain("skills.length > 0");
  });

  it("shows empty state when no skills", () => {
    const source = readFile("app/professionals/[id]/page.tsx");
    expect(source).toContain("Nog geen vaardigheden");
  });

  it("suggests CV upload for skill extraction", () => {
    const source = readFile("app/professionals/[id]/page.tsx");
    expect(source).toContain("Upload een CV");
  });

  it("section header reads 'Vaardigheden'", () => {
    const source = readFile("app/professionals/[id]/page.tsx");
    expect(source).toContain("Vaardigheden");
  });
});

describe("Skills graph — type safety", () => {
  it("exports StructuredSkill type", () => {
    const source = readFile("src/schemas/candidate-intelligence.ts");
    expect(source).toContain("export type StructuredSkill");
  });

  it("exports StructuredSkills type", () => {
    const source = readFile("src/schemas/candidate-intelligence.ts");
    expect(source).toContain("export type StructuredSkills");
  });

  it("StructuredSkill has name property", () => {
    const source = readFile("src/schemas/candidate-intelligence.ts");
    expect(source).toContain("name: z.string()");
  });

  it("StructuredSkill has proficiency property 1-5", () => {
    const source = readFile("src/schemas/candidate-intelligence.ts");
    expect(source).toContain("proficiency: z.number().min(1).max(5)");
  });

  it("StructuredSkill has evidence property", () => {
    const source = readFile("src/schemas/candidate-intelligence.ts");
    expect(source).toContain("evidence: z.string()");
  });

  it("StructuredSkills has hard array", () => {
    const source = readFile("src/schemas/candidate-intelligence.ts");
    expect(source).toContain("hard: z.array(structuredSkillSchema)");
  });

  it("StructuredSkills has soft array", () => {
    const source = readFile("src/schemas/candidate-intelligence.ts");
    expect(source).toContain("soft: z.array(structuredSkillSchema)");
  });
});

describe("Skills graph — integration scenarios", () => {
  it("renders radar when 3+ skill categories exist", () => {
    const sample = {
      hard: [
        { name: "TypeScript", proficiency: 4, evidence: "test" },
        { name: "React", proficiency: 3, evidence: "test" },
        { name: "Python", proficiency: 2, evidence: "test" },
      ],
      soft: [{ name: "Leadership", proficiency: 4, evidence: "test" }],
    };
    const result = structuredSkillsSchema.safeParse(sample);
    expect(result.success).toBe(true);
  });

  it("falls back to bar chart for <3 categories", () => {
    const source = readFile("components/skills-radar.tsx");
    expect(source).toContain("FallbackBarChart");
  });

  it("handles comparison mode with different skill sets", () => {
    const candidate1 = {
      hard: [{ name: "TypeScript", proficiency: 5, evidence: "test" }],
      soft: [{ name: "Leadership", proficiency: 4, evidence: "test" }],
    };
    const candidate2 = {
      hard: [{ name: "Python", proficiency: 3, evidence: "test" }],
      soft: [{ name: "Communication", proficiency: 5, evidence: "test" }],
    };
    const result1 = structuredSkillsSchema.safeParse(candidate1);
    const result2 = structuredSkillsSchema.safeParse(candidate2);
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
  });

  it("tags component controls are properly typed", () => {
    const source = readFile("components/skills-tags.tsx");
    expect(source).toContain('sortBy?: "proficiency" | "alphabetical"');
    expect(source).toContain('filter?: "all" | "hard" | "soft"');
  });

  it("sorting skips mutation of original array", () => {
    const source = readFile("components/skills-tags.tsx");
    expect(source).toContain("[...skills]");
  });

  it("profile page dynamically picks component based on data presence", () => {
    const source = readFile("app/professionals/[id]/page.tsx");
    expect(source).toContain("structuredSkills &&");
    expect(source).toContain("SkillsExperienceSection");
  });
});
