import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]) {
  return readFileSync(path.join(ROOT, ...segments), "utf8");
}

describe("opdracht detail archivedAt compatibility", () => {
  it("keeps opdrachten search reads on the compat projection that omits archived_at", () => {
    const repositorySource = readFile("src", "services", "jobs", "repository.ts");
    const listSource = readFile("src", "services", "jobs", "list.ts");
    const searchSource = readFile("src", "services", "jobs", "search.ts");
    const routeSource = readFile("app", "api", "vacatures", "zoeken", "route.ts");

    expect(repositorySource).toContain("archivedAt: sql<Date | null>`null`");
    expect(listSource).toContain(".select(jobReadSelection)");
    expect(searchSource).toContain(".select(jobReadSelection)");
    expect(routeSource).toContain("runJobPageSearch");
  });

  it("uses one prioritized related-jobs read on the detail page while preserving compat selection", () => {
    const source = readFile("app", "vacatures", "[id]", "page.tsx");
    const detailSource = readFile("src", "services", "jobs", "detail-page.ts");

    expect(source).toContain('import { getJobDetailPageData } from "@/src/services/jobs/detail-page"');
    expect(source).toContain("const detailData = await getJobDetailPageData(id);");
    expect(detailSource).toContain('import { jobReadSelection } from "@/src/services/jobs/repository"');
    expect(detailSource).toContain("companyMatchRank");
    expect(detailSource).toContain("...jobReadSelection");
    expect(detailSource).toContain(".orderBy(companyMatchRank, desc(jobs.scrapedAt))");
    expect(detailSource).toContain("const relatedJobs = relatedJobRows.map");
  });
});
