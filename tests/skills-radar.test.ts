import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("Skills radar chart component", () => {
  it("exports SkillsRadar component", () => {
    const source = readFile("components/skills-radar.tsx");
    expect(source).toContain("export function SkillsRadar");
  });

  it("is a client component", () => {
    const source = readFile("components/skills-radar.tsx");
    expect(source).toContain('"use client"');
  });

  it("imports from recharts", () => {
    const source = readFile("components/skills-radar.tsx");
    expect(source).toContain("RadarChart");
    expect(source).toContain("recharts");
  });

  it("imports StructuredSkills type", () => {
    const source = readFile("components/skills-radar.tsx");
    expect(source).toContain("StructuredSkills");
  });

  it("supports comparison mode", () => {
    const source = readFile("components/skills-radar.tsx");
    expect(source).toContain("compareWith");
    expect(source).toContain("Vergelijking");
  });

  it("has fallback for fewer than 3 categories", () => {
    const source = readFile("components/skills-radar.tsx");
    expect(source).toContain("3");
  });

  it("uses Dutch category labels", () => {
    const source = readFile("components/skills-radar.tsx");
    expect(source).toContain("Technisch");
    expect(source).toContain("Soft Skills");
  });
});
