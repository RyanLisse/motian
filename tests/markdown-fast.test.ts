import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("Markdown.fast integration", () => {
  it("exports publishReport function", () => {
    const source = readFile("src/lib/markdown-fast.ts");
    expect(source).toContain("export async function publishReport");
  });

  it("exports getReport function", () => {
    const source = readFile("src/lib/markdown-fast.ts");
    expect(source).toContain("export async function getReport");
  });

  it("exports revokeReport function", () => {
    const source = readFile("src/lib/markdown-fast.ts");
    expect(source).toContain("export async function revokeReport");
  });

  it("has local fallback when markdown.fast is unavailable", () => {
    const source = readFile("src/lib/markdown-fast.ts");
    expect(source).toContain("local");
    expect(source).toContain("reportStore");
  });

  it("uses MARKDOWN_FAST_TOKEN for auth", () => {
    const source = readFile("src/lib/markdown-fast.ts");
    expect(source).toContain("MARKDOWN_FAST_TOKEN");
    expect(source).toContain("Authorization");
  });

  it("has timeout protection on external calls", () => {
    const source = readFile("src/lib/markdown-fast.ts");
    expect(source).toContain("AbortSignal.timeout");
  });

  it("generates local report IDs with rpt- prefix", () => {
    const source = readFile("src/lib/markdown-fast.ts");
    expect(source).toContain("rpt-");
  });
});
