import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
const EXCLUDED_DIRECTORIES = new Set([".git", ".next", "coverage", "dist", "node_modules"]);
const EXCLUDED_FILES = new Set(["pnpm-lock.yaml"]);
const SCANNED_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".yml",
  ".yaml",
]);
const MERGE_MARKER_PATTERN = /^(<{7}|={7}|>{7})(?: .*)?$/m;

function readFile(...segments: string[]) {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

function collectRepositoryFiles(directory: string, files: string[] = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRECTORIES.has(entry.name)) {
        collectRepositoryFiles(path.join(directory, entry.name), files);
      }
      continue;
    }

    if (EXCLUDED_FILES.has(entry.name) || !SCANNED_EXTENSIONS.has(path.extname(entry.name))) {
      continue;
    }

    files.push(path.join(directory, entry.name));
  }

  return files;
}

describe("Recruiter-first navigation", () => {
  it("keeps recruiter workflow routes prominent in the sidebar", () => {
    const source = readFile("components", "app-sidebar.tsx");
    const commandPaletteSource = readFile("components", "command-palette.tsx");

    expect(source).toContain('title: "Overzicht"');
    expect(source).toContain('title: "Vacatures"');
    expect(source).toContain('title: "Kandidaten"');
    expect(source).toContain('title: "Pipeline"');
    expect(source).toContain('title: "Interviews"');
    expect(source).toContain('title: "Berichten"');
    expect(source).toContain('title: "Automatisering"');

    expect(source).toContain('url: "/overzicht"');
    expect(source).toContain('url: "/vacatures"');
    expect(source).toContain('url: "/kandidaten"');
    expect(source).toContain('url: "/pipeline"');
    expect(source).toContain('url: "/interviews"');
    expect(source).toContain('url: "/messages"');
    expect(source).toContain('url: "/automatisering"');

    expect(source).not.toContain('title: "Aanbevelingen"');
    expect(source).not.toContain('title: "Matching"');
    expect(source).not.toContain('title: "AI Assistent"');
    expect(source).not.toContain('title: "Agents"');
    expect(source).not.toContain('title: "Autopilot"');
    expect(source).not.toContain('title: "Databronnen"');

    expect(commandPaletteSource).toContain('label: "Automatisering"');
    expect(commandPaletteSource).toContain('label: "Agents"');
    expect(commandPaletteSource).toContain('label: "Autopilot"');
    expect(commandPaletteSource).toContain('label: "Databronnen"');
    expect(commandPaletteSource).toContain('label: "Matching"');
    expect(commandPaletteSource).toContain('label: "AI Assistent"');
  });

  it("keeps heavy pipeline visuals out of eager sidebar prefetches", () => {
    const sidebarSource = readFile("components", "app-sidebar.tsx");
    const navSource = readFile("components", "nav-main.tsx");

    expect(sidebarSource).toContain('title: "Pipeline"');
    expect(sidebarSource).toContain("prefetch: false");
    expect(navSource).toContain("prefetch={item.prefetch}");
  });

  it("keeps Automatisering active for demoted operational pages", () => {
    const sidebarSource = readFile("components", "app-sidebar.tsx");
    const navSource = readFile("components", "nav-main.tsx");

    expect(sidebarSource).toContain('matchPaths: ["/agents", "/autopilot", "/scraper"]');
    expect(navSource).toContain("item.matchPaths?.some");
    expect(navSource).toContain("pathname === matchPath");
  });
});

describe("Recruiter-first overview", () => {
  it("frames the dashboard as a recruiter command center", () => {
    const source = readFile("app", "overzicht", "page.tsx");

    expect(source).toContain("Je command center voor vacatures, kandidaten en opvolging");
    expect(source).toContain("Wat vraagt nu aandacht?");
    expect(source).toContain("Aankomende interviews");
    expect(source).toContain("Nieuwe vacatures opvolgen");
    expect(source).toContain("Databronnen");

    expect(source).not.toContain("Aanbevelingen");
    expect(source).not.toContain("Open aanbevelingen");
    expect(source).not.toContain("Recente berichten");
    expect(source).not.toContain('label: "Berichten"');
    expect(source).not.toContain("Dashboard — realtime inzicht in vacatures en scrapers");
  });

  it("keeps the repository free of line-anchored merge conflict markers", () => {
    const filesWithConflictMarkers = collectRepositoryFiles(ROOT)
      .filter((filePath) => MERGE_MARKER_PATTERN.test(fs.readFileSync(filePath, "utf-8")))
      .map((filePath) => path.relative(ROOT, filePath));

    expect(filesWithConflictMarkers).toEqual([]);
  });

  it("keeps empty-state navigation inside candidate and vacancy flows", () => {
    const pipelineSource = readFile("app", "pipeline", "page.tsx");
    const candidateSource = readFile("app", "kandidaten", "[id]", "page.tsx");

    expect(pipelineSource).toContain('href: "/kandidaten"');
    expect(pipelineSource).toContain(`href: \`/vacatures/\${vacatureId}\``);
    expect(pipelineSource).not.toContain(
      `href: vacature ? \`/matching?jobId=\${vacatureId}\` : "/matching"`,
    );
    expect(candidateSource).toContain(`href: \`/kandidaten/\${candidate.id}#matches\``);
    expect(candidateSource).toContain('label: "Bekijk matchkansen"');
    expect(candidateSource).toContain('<section id="matches">');
    expect(candidateSource).not.toContain(': { href: "/matching", label: "Bekijk matches" }');
  });
});
