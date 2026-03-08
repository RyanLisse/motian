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
    expect(source).toContain("Nog geen shortlist");
    expect(source).toContain("Koppel topmatches");
    expect(source).toContain("Gekoppelde kandidaten");
    expect(source).toContain("Volgende stap");
    expect(source).toContain("source: applications.source");
    expect(source).toContain(`/professionals/\${row.candidateId}`);
  });

  it("job detail page uses the side panel shell and inline linking workspace", () => {
    const page = readFile("app/opdrachten/[id]/page.tsx");
    const detailSheet = readFile("components/opdrachten-detail-sheet.tsx");
    const linker = readFile("components/link-candidates-dialog.tsx");

    expect(page).toContain("OpdrachtenDetailSheet");
    expect(page).toContain("Vacaturedetails");
    expect(page).toContain("Nog te koppelen kandidaten");
    expect(page).toContain('id="koppel-kandidaten"');
    expect(page).toContain('variant="inline"');
    expect(detailSheet).toContain("useIsMobile");
    expect(detailSheet).toContain("router.push(listHref)");
    expect(linker).toContain('variant?: "dialog" | "inline"');
    expect(linker).toContain('variant === "inline" || open');
    expect(linker).toContain("Koppel aan screening");
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
