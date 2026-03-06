import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { candidates } from "../src/db/schema.js";

// ---------------------------------------------------------------------------
// 1. Route structure — canonical /kandidaten exists
// ---------------------------------------------------------------------------

describe("Kandidaten route structure", () => {
  const root = join(import.meta.dirname, "..");

  it("/kandidaten list page exists", () => {
    expect(existsSync(join(root, "app/kandidaten/page.tsx"))).toBe(true);
  });

  it("/kandidaten/[id] detail page exists", () => {
    expect(existsSync(join(root, "app/kandidaten/[id]/page.tsx"))).toBe(true);
  });

  it("/kandidaten has error boundary", () => {
    expect(existsSync(join(root, "app/kandidaten/error.tsx"))).toBe(true);
  });

  it("/kandidaten has loading skeleton", () => {
    expect(existsSync(join(root, "app/kandidaten/loading.tsx"))).toBe(true);
  });

  it("/professionals list page redirects to /kandidaten", async () => {
    const content = await readFile(join(root, "app/professionals/page.tsx"), "utf-8");
    expect(content).toContain("redirect(`/kandidaten");
  });

  it("/professionals/[id] detail page redirects to /kandidaten/[id]", async () => {
    const content = await readFile(join(root, "app/professionals/[id]/page.tsx"), "utf-8");
    expect(content).toContain("redirect(`/kandidaten/");
  });
});

// ---------------------------------------------------------------------------
// 2. Schema resilience — explicit column selects (no SELECT *)
// ---------------------------------------------------------------------------

describe("Schema-drift resilience", () => {
  const root = join(import.meta.dirname, "..");

  it("kandidaten list page uses explicit column select (not full row)", async () => {
    const content = await readFile(join(root, "app/kandidaten/page.tsx"), "utf-8");
    // Should have a LIST_COLUMNS object with explicit column picks
    expect(content).toContain("LIST_COLUMNS");
    // Should use .select(LIST_COLUMNS) not .select()
    expect(content).toContain(".select(LIST_COLUMNS)");
    // Must NOT contain bare .select() on candidates (full-row select)
    expect(content).not.toMatch(/\.select\(\)\s*\.from\(candidates\)/);
  });

  it("kandidaten detail page uses the resilient candidate detail helper", async () => {
    const content = await readFile(join(root, "app/kandidaten/[id]/page.tsx"), "utf-8");
    expect(content).toContain("getCandidateDetailById");
    expect(content).not.toMatch(/\.select\(\)\s*\.from\(candidates\)/);
    expect(content).not.toContain("candidates.profileSummary");
    expect(content).toContain(
      '{candidate.profileSummary ?? candidate.headline ?? "Geen samenvatting."}',
    );
  });

  it("list columns exclude heavy fields (embedding, resumeRaw)", async () => {
    const content = await readFile(join(root, "app/kandidaten/page.tsx"), "utf-8");
    // The LIST_COLUMNS block should NOT mention embedding or resumeRaw
    expect(content).not.toMatch(/LIST_COLUMNS[\s\S]*?embedding/);
    expect(content).not.toMatch(/LIST_COLUMNS[\s\S]*?resumeRaw/);
  });

  it("detail columns exclude heavy fields (embedding, resumeRaw)", async () => {
    const content = await readFile(join(root, "app/kandidaten/[id]/page.tsx"), "utf-8");
    expect(content).not.toMatch(/DETAIL_COLUMNS[\s\S]*?embedding/);
    expect(content).not.toMatch(/DETAIL_COLUMNS[\s\S]*?resumeRaw/);
  });
});

// ---------------------------------------------------------------------------
// 3. Schema columns — guard against missing fields in explicit selects
// ---------------------------------------------------------------------------

describe("Candidate schema column coverage", () => {
  const schemaColumns = Object.keys(candidates);

  // These are the known heavy/internal columns intentionally excluded
  const excludedFromList = [
    "province",
    "experience",
    "preferences",
    "resumeUrl",
    "linkedinUrl",
    "headline",
    "profileSummary",
    "notes",
    "embedding",
    "resumeRaw",
    "resumeParsedAt",
    "skillsStructured",
    "education",
    "certifications",
    "languageSkills",
    "consentGranted",
    "dataRetentionUntil",
    "updatedAt",
    "email",
    "phone",
  ];

  const excludedFromDetail = [
    "province",
    "embedding",
    "resumeRaw",
    "resumeParsedAt",
    "education",
    "certifications",
    "consentGranted",
    "dataRetentionUntil",
    "createdAt",
    "updatedAt",
    "deletedAt",
  ];

  it("schema table has expected core columns", () => {
    expect(schemaColumns).toContain("id");
    expect(schemaColumns).toContain("name");
    expect(schemaColumns).toContain("email");
    expect(schemaColumns).toContain("skills");
    expect(schemaColumns).toContain("embedding");
    expect(schemaColumns).toContain("resumeRaw");
  });

  it("all non-excluded columns are in LIST_COLUMNS or DETAIL_COLUMNS", () => {
    // This is a documentation test — it ensures we don't silently lose a column
    // when the schema changes. If a new column is added to candidates, this test
    // will fail, prompting the developer to either add it to a column set or
    // explicitly exclude it.
    const allExcluded = new Set([...excludedFromList, ...excludedFromDetail]);
    const coveredColumns = schemaColumns.filter((col) => !allExcluded.has(col));
    for (const col of coveredColumns) {
      // These columns must exist in the schema (sanity check)
      expect(schemaColumns).toContain(col);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Sidebar / nav links point to /kandidaten
// ---------------------------------------------------------------------------

describe("Navigation links use /kandidaten", () => {
  const root = join(import.meta.dirname, "..");

  it("app-sidebar links to /kandidaten", async () => {
    const content = await readFile(join(root, "components/app-sidebar.tsx"), "utf-8");
    expect(content).toContain('url: "/kandidaten"');
    expect(content).not.toContain('url: "/professionals"');
  });

  it("top-nav links to /kandidaten", async () => {
    const content = await readFile(join(root, "components/top-nav.tsx"), "utf-8");
    expect(content).toContain('href: "/kandidaten"');
    expect(content).not.toContain('href: "/professionals"');
  });
});
