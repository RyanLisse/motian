import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The sidebar search query sets `placeholderData: (prev) => prev`, which keeps
 * the previous query's rows mounted while a new one is in flight so the list
 * does not collapse. Observed in the 2026-09-04 production repro as a "brief
 * stale results flash": for the 1.5s+ a search takes, rows for the *previous*
 * query are presented as if they answered the one just typed.
 *
 * The fix is to mark them, not to drop them — dropping them reintroduces the
 * layout collapse the placeholder exists to prevent.
 */
describe("stale search results are marked, not asserted", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  const hook = read("components/sidebar/use-sidebar-filters.ts");
  const list = read("components/sidebar/sidebar-job-list.tsx");
  const sidebar = read("components/opdrachten-sidebar.tsx");

  it("keeps the placeholder that prevents the list from collapsing", () => {
    expect(hook).toContain("placeholderData: (prev) => prev");
  });

  it("derives staleness from the query's own placeholder signal", () => {
    expect(hook).toContain("isPlaceholderData");
    expect(hook).toContain("isShowingStaleResults: isFetching && isPlaceholderData");
  });

  it("passes staleness to every job list the sidebar renders", () => {
    const usages = sidebar.match(/isStale=\{isShowingStaleResults\}/g) ?? [];
    const lists = sidebar.match(/jobs=\{displayJobs\}/g) ?? [];
    expect(usages.length).toBe(lists.length);
    expect(usages.length).toBeGreaterThan(0);
  });

  it("marks stale rows visually and for assistive tech", () => {
    expect(list).toContain("isStale?: boolean");
    expect(list).toContain("opacity-50");
    expect(list).toContain("aria-busy={isStale}");
  });

  it("still renders the rows rather than blanking the list", () => {
    // The placeholder's whole purpose: rows stay mounted while dimmed.
    expect(list).not.toContain("if (isStale) return null");
  });
});
