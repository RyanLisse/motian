import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("WebMCP documentation coverage", () => {
  it("documents WebMCP on the developer page", () => {
    const source = readFile("app", "ontwikkelaar", "page.tsx");

    expect(source).toContain('label: "WebMCP"');
    expect(source).toContain("MCP-B extensie + ingebouwde browsertools");
    expect(source).toContain("WebMCP setup");
  });

  it("mentions WebMCP in both README variants", () => {
    const dutchReadme = readFile("README.md");
    const englishReadme = readFile("README.en.md");

    expect(dutchReadme).toContain("#### WebMCP in de browser");
    expect(dutchReadme).toContain("motian_");
    expect(englishReadme).toContain("#### WebMCP in the Browser");
    expect(englishReadme).toContain("motian_");
  });

  it("registers the Motian browser tool names in the WebMCP provider", () => {
    const source = readFile("components", "webmcp", "motian-webmcp-provider.tsx");

    expect(source).toContain('name: "motian_get_current_page_context"');
    expect(source).toContain('name: "motian_navigate"');
    expect(source).toContain('name: "motian_refresh_route"');
    expect(source).toContain('vacatures: "/vacatures"');
    expect(source).toContain('kandidaten: "/kandidaten"');
  });
});
