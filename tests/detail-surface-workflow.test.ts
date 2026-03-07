import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]) {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("Detail surfaces recruiter workflow context", () => {
  it("job detail page surfaces a recruiter cockpit with linked candidate context", () => {
    const source = readFile("app/opdrachten/[id]/page.tsx");

    expect(source).toContain("Recruiter cockpit");
    expect(source).toContain("Volgende actie");
    expect(source).toContain("Gekoppelde kandidaten");
    expect(source).toContain("source: applications.source");
    // biome-ignore lint/suspicious/noTemplateCurlyInString: asserting source contains a template literal
    expect(source).toContain("/professionals/${row.candidateId}");
  });

  it("candidate detail page reads applications and surfaces active recruiter context", () => {
    const source = readFile("app/professionals/[id]/page.tsx");

    expect(source).toContain("applications");
    expect(source).toContain("Recruiter context");
    expect(source).toContain("Actieve sollicitaties");
    expect(source).toContain("eq(applications.candidateId, id)");
  });

  it("candidate detail page distinguishes linked workflow from remaining match opportunities", () => {
    const source = readFile("app/professionals/[id]/page.tsx");

    expect(source).toContain("Overige matchkansen");
    expect(source).toContain("Open fase");
    expect(source).toContain("Gelinkte matches");
  });
});
