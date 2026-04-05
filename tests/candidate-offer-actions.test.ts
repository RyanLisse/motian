import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("candidate offer actions", () => {
  it("renders commercial cv and channel handoff actions on kandidaat detail", () => {
    const source = readFile("app/kandidaten/[id]/page.tsx");
    expect(source).toContain("CandidateOfferActions");
  });

  it("loads commercial cv drafts and channel handoff data in the shared action component", () => {
    const source = readFile("components/candidate-offer-actions.tsx");
    expect(source).toContain("/api/commercieel-cv");
    expect(source).toContain("kanaal-aanbod");
    expect(source).toContain("Commercieel CV");
    expect(source).toContain("Kanaal-aanbod");
    expect(source).toContain("Kopieer handoff");
  });

  it("exposes a dedicated kanaal-aanbod route under kandidaten", () => {
    const source = readFile("app/api/kandidaten/[id]/kanaal-aanbod/route.ts");
    expect(source).toContain("prepareChannelOfferHandoff");
    expect(source).toContain("POST /api/kandidaten/[id]/kanaal-aanbod");
  });
});
