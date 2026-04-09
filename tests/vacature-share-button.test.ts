import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("vacature sharing actions", () => {
  it("shows the share button on vacature detail", () => {
    const source = readFile("app/vacatures/[id]/page.tsx");
    expect(source).toContain("VacatureShareButton");
  });

  it("supports native share or clipboard fallback", () => {
    const source = readFile("components/vacature-share-button.tsx");
    expect(source).toContain("navigator.share");
    expect(source).toContain("navigator.clipboard.writeText");
    expect(source).toContain("Vacature delen");
  });
});
