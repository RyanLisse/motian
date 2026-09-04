import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Structural guard, in the same spirit as tests/scraper-dashboard-layout-fixes.test.ts.
 *
 * /kandidaten measured ~3.2s for a single candidate on 2026-09-04 — the slowest
 * route in the app — because the ESCO skills catalog was awaited before the
 * candidate queries started. With the Neon pool at `max: 1` that is strictly
 * serial, so the catalog's two queries land in front of every page load.
 *
 * The dependency is narrow: the catalog only decides which query to run when a
 * skill is actually selected. Re-inlining a blanket `await getSkillsFilterData()`
 * would silently restore the serialization, so assert the shape instead.
 */
describe("/kandidaten data loading", () => {
  const source = readFileSync(join(process.cwd(), "app/kandidaten/page.tsx"), "utf8");

  it("starts the skills catalog fetch without awaiting it up front", () => {
    expect(source).toContain("const skillsPromise = getSkillsFilterData()");
    expect(source).not.toContain("await getSkillsFilterData()");
  });

  it("resolves the catalog inside the parallel batch, not ahead of it", () => {
    expect(source).toContain(
      "const [candidateRows, stats, totalCount, skillsData] = await Promise.all([",
    );
    expect(source).toContain("skillsPromise,");
  });

  it("only blocks on the catalog when a skill filter is actually selected", () => {
    expect(source).toContain("skillSlug\n    ? (await skillsPromise).escoCatalogAvailable");
  });

  it("keeps a fallback so a catalog failure cannot break the page", () => {
    expect(source).toContain("SKILLS_FILTER_FALLBACK");
    expect(source).toContain("[Kandidaten] getSkillsFilterData failed:");
  });

  it("still derives the filter dropdown from the resolved catalog", () => {
    expect(source).toContain(
      "const { skillOptions, escoCatalogAvailable, escoCatalogMessage } = skillsData;",
    );
  });
});
