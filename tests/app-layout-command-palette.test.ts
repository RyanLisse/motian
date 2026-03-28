import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("app layout command palette wiring", () => {
  it("imports the client command palette directly instead of using ssr:false dynamic in the server layout", () => {
    const source = readFile("app", "layout.tsx");

    expect(source).toContain('import { CommandPalette } from "@/components/command-palette"');
    expect(source).toContain("<CommandPalette />");
    expect(source).not.toContain("next/dynamic");
    expect(source).not.toContain("ssr: false");
  });
});
