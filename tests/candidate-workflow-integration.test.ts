import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]) {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("candidate workflow recommendation surfaces", () => {
  it("candidate detail page embeds an in-flow recommendation panel", () => {
    const source = readFile("app/professionals/[id]/page.tsx");

    expect(source).toContain("CandidateRecommendationPanel");
    expect(source).toContain("initialMatches={recommendationMatches}");
  });

  it("recommendation panel uses candidate-side match and link endpoints", () => {
    const source = readFile("components/candidate-recommendation-panel.tsx");

    expect(source).toMatch(/\/api\/kandidaten\/\$\{candidateId\}\/match/);
    expect(source).toMatch(/\/api\/kandidaten\/\$\{candidateId\}\/koppel/);
    expect(source).toContain("Start screening op aanbeveling");
  });

  it("auto-match results refresh the detail page after matching completes", () => {
    const source = readFile("components/auto-match-results.tsx");

    expect(source).toContain("useRouter");
    expect(source).toContain("router.refresh()");
  });
});
