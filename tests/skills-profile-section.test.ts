import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("Skills section on professional detail page", () => {
  it("imports SkillsRadar component", () => {
    const source = readFile("app/professionals/[id]/page.tsx");
    expect(source).toContain("SkillsRadar");
  });

  it("imports SkillsTags component", () => {
    const source = readFile("app/professionals/[id]/page.tsx");
    expect(source).toContain("SkillsTags");
  });

  it("reads skillsStructured from candidate", () => {
    const source = readFile("app/professionals/[id]/page.tsx");
    expect(source).toContain("skillsStructured");
  });

  it("has legacy fallback for flat skills array", () => {
    const source = readFile("app/professionals/[id]/page.tsx");
    expect(source).toContain("skills.length > 0");
  });

  it("has empty state message in Dutch", () => {
    const source = readFile("app/professionals/[id]/page.tsx");
    expect(source).toContain("Nog geen vaardigheden");
  });
});
