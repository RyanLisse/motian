import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const SIDEBAR_DIR = join(ROOT, "components", "sidebar");
const CONTAINER_FILE = join(ROOT, "components", "opdrachten-sidebar.tsx");

describe("Sidebar decomposition", () => {
  it("components/sidebar/ directory exists", () => {
    expect(existsSync(SIDEBAR_DIR)).toBe(true);
  });

  const expectedFiles = [
    "sidebar-types.ts",
    "sidebar-utils.ts",
    "sidebar-search-bar.tsx",
    "sidebar-sort-controls.tsx",
    "sidebar-filter-controls.tsx",
    "sidebar-job-list.tsx",
    "sidebar-pagination.tsx",
    "sidebar-results-header.tsx",
    "compact-sidebar-filters.tsx",
    "overview-filter-panel.tsx",
    "use-sidebar-filters.ts",
  ];

  for (const file of expectedFiles) {
    it(`sidebar/${file} exists`, () => {
      expect(existsSync(join(SIDEBAR_DIR, file))).toBe(true);
    });
  }

  it("opdrachten-sidebar.tsx imports from sidebar/ sub-components", () => {
    const content = readFileSync(CONTAINER_FILE, "utf8");
    const sidebarImports = content
      .split("\n")
      .filter((line) => /from\s+["']\.\/sidebar\//.test(line));
    // Should import at least 5 sub-components
    expect(sidebarImports.length).toBeGreaterThanOrEqual(5);
  });

  it("opdrachten-sidebar.tsx is under 300 lines", () => {
    const lineCount = readFileSync(CONTAINER_FILE, "utf8").split("\n").length;
    expect(lineCount).toBeLessThanOrEqual(300);
  });

  it("no sidebar/ file exceeds 500 lines", () => {
    const files = readdirSync(SIDEBAR_DIR);
    for (const file of files) {
      const filePath = join(SIDEBAR_DIR, file);
      const lineCount = readFileSync(filePath, "utf8").split("\n").length;
      expect(lineCount, `${file} has ${lineCount} lines`).toBeLessThanOrEqual(550);
    }
  });
});
