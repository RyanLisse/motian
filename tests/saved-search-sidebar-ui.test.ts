import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Structural test: verify the compact sidebar filters source contains
 * the saved-search UI strings required by RJC-55.
 */
describe("Saved search sidebar UI (structural)", () => {
  const source = readFileSync(
    resolve(__dirname, "../components/sidebar/compact-sidebar-filters.tsx"),
    "utf-8",
  );

  it('contains "Opgeslagen filters" dropdown label', () => {
    expect(source).toContain("Opgeslagen filters");
  });

  it('contains "Zoekfilter opslaan" save button label', () => {
    expect(source).toContain("Zoekfilter opslaan");
  });

  it("imports Dialog or Popover from the UI library", () => {
    const hasPopover = source.includes("@/components/ui/popover");
    const hasDialog = source.includes("@/components/ui/dialog");
    expect(hasPopover || hasDialog).toBe(true);
  });

  it("fetches saved filters from the API endpoint", () => {
    expect(source).toContain("/api/zoekfilters");
  });
});
