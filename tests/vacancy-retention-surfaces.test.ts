import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
const JOBS_PLATFORM_PLACEHOLDER = "$" + "{jobs.platform}";

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("vacancy retention surfaces", () => {
  it("keeps the salesforce jobs feed visible by default while supporting explicit retained status filters", () => {
    const source = readFile("src", "services", "salesforce-feed.ts");

    expect(source).toContain("getVisibleVacancyCondition()");
    expect(source).toContain("getJobStatusCondition(status)");
    expect(source).toContain(
      "query.id || hasExplicitStatus ? undefined : getVisibleVacancyCondition()",
    );
  });

  it("uses shared vacancy visibility rules for background enrichment and embeddings", () => {
    const enrichment = readFile("src", "services", "ai-enrichment.ts");
    const embeddings = readFile("trigger", "embeddings-batch.ts");

    expect(enrichment).toContain("getVisibleVacancyCondition()");
    expect(embeddings).toContain("getVisibleVacancyCondition()");
    expect(embeddings).not.toContain("isNull(jobs.deletedAt)");
  });

  it("counts retained vacancies in scrape analytics and overlap candidate selection", () => {
    const analytics = readFile("src", "services", "scrape-results.ts");
    const dashboard = readFile("src", "services", "scraper-dashboard.ts");
    const workspace = readFile("src", "services", "workspace.ts");
    const detailPage = readFile("app", "opdrachten", "[id]", "page.tsx");

    expect(analytics).toContain(
      "database.select({ count: sql<number>`count(*)::int` }).from(jobs)",
    );
    expect(dashboard).toContain(`.where(sql\`${JOBS_PLATFORM_PLACEHOLDER} is not null\`)`);
    expect(dashboard).not.toContain(
      `and(isNull(jobs.deletedAt), sql\`${JOBS_PLATFORM_PLACEHOLDER} is not null\`)\n`,
    );
    expect(workspace).not.toContain("select count(*)::int from jobs where deleted_at is null");
    expect(workspace).not.toContain(
      "select count(embedding)::int from jobs where deleted_at is null",
    );
    expect(detailPage).not.toContain("isNull(jobs.deletedAt)");
  });
});
