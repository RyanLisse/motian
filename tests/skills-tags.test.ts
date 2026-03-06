import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("Skills tags component", () => {
  it("exports SkillsTags component", () => {
    const source = readFile("components/skills-tags.tsx");
    expect(source).toContain("export function SkillsTags");
  });

  it("is a client component", () => {
    const source = readFile("components/skills-tags.tsx");
    expect(source).toContain('"use client"');
  });

  it("imports StructuredSkills type", () => {
    const source = readFile("components/skills-tags.tsx");
    expect(source).toContain("StructuredSkills");
  });

  it("renders proficiency dots", () => {
    const source = readFile("components/skills-tags.tsx");
    expect(source).toContain("proficiency");
    expect(source).toContain("rounded-full");
  });

  it("has Dutch section headers", () => {
    const source = readFile("components/skills-tags.tsx");
    expect(source).toContain("Harde vaardigheden");
    expect(source).toContain("Zachte vaardigheden");
  });

  it("supports filter and sort controls", () => {
    const source = readFile("components/skills-tags.tsx");
    expect(source).toContain("useState");
    expect(source).toContain("sortBy");
    expect(source).toContain("filter");
  });

  it("uses semantic Tailwind theme tokens", () => {
    const source = readFile("components/skills-tags.tsx");
    expect(source).toContain("text-primary");
    expect(source).toContain("bg-card");
  });

  it("shows evidence affordance for explainability", () => {
    const source = readFile("components/skills-tags.tsx");
    expect(source).toContain("Bron: CV-analyse");
    expect(source).toContain("TooltipContent");
    expect(source).toContain("Info");
    expect(source).toContain("proficiencyLabels");
  });

  it("supports active skill highlighting for linked experience filtering", () => {
    const source = readFile("components/skills-tags.tsx");
    expect(source).toContain("activeSkill");
    expect(source).toContain("onSkillClick");
  });
});
