import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("saved search sidebar UI", () => {
  it("exposes save and saved-filter controls in the compact vacancy sidebar", () => {
    const source = readFile("components/sidebar/compact-sidebar-filters.tsx");

    expect(source).toContain("Zoekfilter opslaan");
    expect(source).toContain("Opgeslagen filters");
    expect(source).toContain("Verwijderen");
    expect(source).toContain("/api/zoekfilters");
    expect(source).toContain("DropdownMenu");
    expect(source).toContain("Dialog");
  });
});
