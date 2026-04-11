import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { extractFactsFromContent, runRepoLearning } from "../src/services/repo-learning";

describe("repo learning extractor", () => {
  it("extracts test-recipe facts from test source", () => {
    const facts = extractFactsFromContent(
      "tests/jobs-search.test.ts",
      `describe("jobs search", () => { it("filters by platform", () => {}) })`,
      "2026-04-10T00:00:00.000Z",
    );

    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({
      taxonomy: "test-recipe",
      source: "repo-extractor",
      module: "jobs-search",
    });
    expect(facts[0]?.fact).toContain("filters by platform");
  });

  it("extracts convention facts from AGENTS markdown", () => {
    const facts = extractFactsFromContent(
      "src/AGENTS.md",
      `- Keep service boundaries clean\n- Run pnpm lint`,
      "2026-04-10T00:00:00.000Z",
    );

    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({ taxonomy: "convention", sourcePath: "src/AGENTS.md" });
  });
});

describe("runRepoLearning", () => {
  let repoRoot = "";

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), "repo-learning-"));
    execFileSync("git", ["init"], { cwd: repoRoot });
    execFileSync("git", ["config", "user.email", "repo-learning@example.com"], { cwd: repoRoot });
    execFileSync("git", ["config", "user.name", "Repo Learning"], { cwd: repoRoot });

    mkdirSync(join(repoRoot, "tests"), { recursive: true });
    writeFileSync(
      join(repoRoot, "tests", "sample.test.ts"),
      `describe("sample", () => { it("works", () => {}) });\n`,
      "utf-8",
    );

    writeFileSync(join(repoRoot, "AGENTS.md"), "- Keep changes minimal\n", "utf-8");
    execFileSync("git", ["add", "."], { cwd: repoRoot });
    execFileSync("git", ["commit", "-m", "chore: seed repo"], { cwd: repoRoot });
  });

  it("writes extracted facts and state for the current SHA", () => {
    const result = runRepoLearning({ repoRoot });

    expect(result.headSha).toMatch(/[a-f0-9]{40}/);
    expect(result.factCount).toBeGreaterThan(0);

    const facts = JSON.parse(readFileSync(result.outputPath, "utf-8")) as Array<{ source: string }>;
    expect(facts.length).toBeGreaterThan(0);
    expect(facts.every((fact) => fact.source === "repo-extractor")).toBe(true);
  });
});
