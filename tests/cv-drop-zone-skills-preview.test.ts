import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("cv drop zone skills preview", () => {
  it("surfaces extracted skills in the post-upload overlay", () => {
    const source = readFile("components/cv-drop-zone.tsx");
    expect(source).toContain("Geëxtraheerde vaardigheden");
    expect(source).toContain("Hard skills");
    expect(source).toContain("Soft skills");
  });

  it("links the overlay to the canonical kandidaat skills section", () => {
    const source = readFile("components/cv-drop-zone.tsx");
    expect(source).toContain("#vaardigheden");
    expect(source).toContain("Naar profielskills");
  });
});
