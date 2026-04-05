import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("vacature shortlist surface", () => {
  it("uses explicit shortlist language on vacature detail", () => {
    const source = readFile("app/vacatures/[id]/page.tsx");
    expect(source).toContain('id="shortlist"');
    expect(source).toContain("Shortlist");
    expect(source).toContain("Nog geen kandidaten in de shortlist");
  });
});
