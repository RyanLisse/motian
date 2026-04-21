import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  COMMAND_PALETTE_PAGES,
  isAnyNavItemActive,
  isNavItemActive,
  MEER_NAV_ITEMS,
  PRIMARY_NAV_ITEMS,
} from "../components/navigation-config";

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
  it("covers direct helper matching for exact, nested, and alias paths", () => {
    const vacaturesItem = PRIMARY_NAV_ITEMS.find((item) => item.title === "Vacatures");
    const kandidatenItem = PRIMARY_NAV_ITEMS.find((item) => item.title === "Kandidaten");

    if (!vacaturesItem || !kandidatenItem) {
      throw new Error("Expected primary navigation items to include Vacatures and Kandidaten");
    }

    expect(isNavItemActive("/vacatures", vacaturesItem)).toBe(true);
    expect(isNavItemActive("/vacatures/123", vacaturesItem)).toBe(true);
    expect(isNavItemActive("/opdrachten/123", vacaturesItem)).toBe(false);
    expect(isNavItemActive("/agents", kandidatenItem)).toBe(false);
  });

  it("marks overflow routes active through the shared helper", () => {
    expect(isAnyNavItemActive("/messages", MEER_NAV_ITEMS)).toBe(true);
    expect(isAnyNavItemActive("/messages/thread-1", MEER_NAV_ITEMS)).toBe(true);
    expect(isAnyNavItemActive("/settings", MEER_NAV_ITEMS)).toBe(false);
  });

  it("defines a 5-item primary nav plus a 6-item Meer overflow", () => {
    expect(PRIMARY_NAV_ITEMS.map((item) => item.title)).toEqual([
      "Overzicht",
      "Vacatures",
      "Kandidaten",
      "Pipeline",
      "Chat",
    ]);
    expect(MEER_NAV_ITEMS.map((item) => item.title)).toEqual([
      "Interviews",
      "Berichten",
      "Matching",
      "Agents",
      "Autopilot",
      "Databronnen",
    ]);
    expect(PRIMARY_NAV_ITEMS.find((item) => item.title === "Pipeline")?.prefetch).toBe(false);
    expect(
      PRIMARY_NAV_ITEMS.find((item) => item.title === "Vacatures")?.matchPaths,
    ).toBeUndefined();
  });

  it("keeps the shell focused on primary nav plus an explicit overflow entry", () => {
    const sidebarSource = readFile("components", "app-sidebar.tsx");
    const overflowSource = readFile("components", "nav-overflow-menu.tsx");
    const mobileNavSource = readFile("components", "mobile-bottom-nav.tsx");
    const shellSource = readFile("components", "sidebar-layout.tsx");

    expect(sidebarSource).toContain("PRIMARY_NAV_ITEMS");
    expect(sidebarSource).toContain("OverflowNavMenu");
    expect(overflowSource).toContain("MEER_NAV_ITEMS");
    expect(overflowSource).toContain("isAnyNavItemActive(pathname, MEER_NAV_ITEMS)");
    expect(mobileNavSource).toContain("PRIMARY_NAV_ITEMS");
    expect(mobileNavSource).not.toContain('pathname.startsWith("/chat")');
    expect(shellSource).toContain('<OverflowNavMenu variant="mobile"');
  });

  it("keeps command palette coverage for moved and utility destinations", () => {
    const commandPaletteSource = readFile("components", "command-palette.tsx");
    const labels = COMMAND_PALETTE_PAGES.map((page) => page.label);

    expect(labels).toEqual(
      expect.arrayContaining([
        "Overzicht",
        "Vacatures",
        "Kandidaten",
        "Pipeline",
        "Chat",
        "Interviews",
        "Berichten",
        "Matching",
        "Agents",
        "Autopilot",
        "Databronnen",
        "Automatisering",
        "Vaardigheden",
        "Instellingen",
        "API Documentatie",
        "XML Feed",
        "MCP Server",
        "OpenAPI Spec",
      ]),
    );
    expect(commandPaletteSource).toContain("COMMAND_PALETTE_PAGES");
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
