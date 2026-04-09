import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Vaardigheden page", () => {
  const pagePath = resolve(__dirname, "../app/vaardigheden/page.tsx");
  const loadingPath = resolve(__dirname, "../app/vaardigheden/loading.tsx");

  it("page file exists and exports default", () => {
    const source = readFileSync(pagePath, "utf-8");
    expect(source).toBeTruthy();
    expect(source).toContain("export default");
  });

  it("page imports PageHeader component", () => {
    const source = readFileSync(pagePath, "utf-8");
    expect(source).toContain("PageHeader");
  });

  it("page imports Badge component", () => {
    const source = readFileSync(pagePath, "utf-8");
    expect(source).toContain("Badge");
  });

  it("page imports from @/src/db", () => {
    const source = readFileSync(pagePath, "utf-8");
    expect(source).toContain("@/src/db");
  });

  it("page uses revalidate for ISR", () => {
    const source = readFileSync(pagePath, "utf-8");
    expect(source).toMatch(/export\s+const\s+revalidate\s*=\s*300/);
  });

  it("page references candidateSkills and escoSkills tables", () => {
    const source = readFileSync(pagePath, "utf-8");
    expect(source).toContain("candidateSkills");
    expect(source).toContain("escoSkills");
  });

  it("page links skills to /kandidaten?vaardigheid=", () => {
    const source = readFileSync(pagePath, "utf-8");
    expect(source).toContain("/kandidaten?vaardigheid=");
  });

  it("loading skeleton file exists", () => {
    const source = readFileSync(loadingPath, "utf-8");
    expect(source).toBeTruthy();
    expect(source).toContain("Skeleton");
  });
});
