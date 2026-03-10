import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readFile(...segments: string[]) {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}

describe("opdracht detail archivedAt compatibility", () => {
  it("keeps opdrachten search reads on the compat projection that omits archived_at", () => {
    const repositorySource = readFile("src", "services", "jobs", "repository.ts");
    const listSource = readFile("src", "services", "jobs", "list.ts");
    const searchSource = readFile("src", "services", "jobs", "search.ts");
    const routeSource = readFile("app", "api", "opdrachten", "zoeken", "route.ts");

    expect(repositorySource).toContain("archivedAt: sql<Date | null>`null`");
    expect(listSource).toContain(".select(jobReadSelection)");
    expect(searchSource).toContain(".select(jobReadSelection)");
    expect(routeSource).toContain("searchJobsUnified");
  });

  it("uses one prioritized related-jobs read on the detail page while preserving compat selection", () => {
    const source = readFile("app", "opdrachten", "[id]", "page.tsx");

    expect(source).toContain('import { jobReadSelection } from "@/src/services/jobs/repository"');
    expect(source).toContain("companyMatchRank");
    expect(source).toContain("...jobReadSelection");
    expect(source).toContain(".orderBy(companyMatchRank, desc(jobs.scrapedAt))");
    expect(source).toContain("companyRelated.length > 0 ? companyRelated : genericRelated");
  });
});
