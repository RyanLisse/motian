import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CandidateIntakeScorecard } from "../components/candidate-profile/candidate-intake-scorecard";
import type { RecruiterMatchBrief } from "../components/matching/match-brief";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]) {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("recruiter insights candidate UI", () => {
  it("renders the candidate intake scorecard component on the candidate detail page", () => {
    const source = readFile("app", "kandidaten", "[id]", "page.tsx");
    expect(source).toContain("CandidateIntakeScorecard");
    expect(source).toContain("candidateIntakeScorecard");
  });

  it("renders recruiter match briefs for expanded matches", () => {
    const source = readFile("app", "kandidaten", "[id]", "page.tsx");
    expect(source).toContain("buildMatchBrief");
    expect(source).toContain("RecruiterMatchBrief");
  });

  it("exports the candidate intake scorecard component", () => {
    const html = renderToStaticMarkup(
      <CandidateIntakeScorecard
        scorecard={{
          summary: "Sterk profiel. Het profiel heeft genoeg signaal voor matching.",
          completenessScore: 88,
          completenessLabel: "Sterk profiel",
          completenessItems: [
            { label: "Rol", value: "Aanwezig", tone: "goed" },
            { label: "Locatie", value: "Aanwezig", tone: "goed" },
          ],
          parsedSkillsQuality: {
            label: "Skillskwaliteit",
            value: "3 hard skills met bewijs",
            tone: "goed",
          },
          escoCoverage: {
            label: "ESCO-dekking",
            value: "3 canonieke skills",
            tone: "goed",
          },
          likelySeniority: {
            label: "Senioriteit",
            value: "Senior (9+ jaar)",
            tone: "goed",
          },
          nextAction: {
            key: "auto-match",
            label: "Auto-match klaar",
            reason: "Voldoende skill- en ESCO-signaal.",
          },
        }}
      />,
    );

    expect(html).toContain("Kandidaat intake scorecard");
    expect(html).toContain("Aanbevolen volgende stap");
    expect(html).toContain("Auto-match klaar");
  });

  it("exports the recruiter match brief component", () => {
    const html = renderToStaticMarkup(
      <RecruiterMatchBrief
        brief={{
          summary: "Sterke match op basis van Java en recruiter-fit.",
          whyThisMatchExists: ["Java overlap", "Sterke initiële matchscore"],
          mustHavesMet: ["Java"],
          mustHavesMissing: ["Spring Boot"],
          escoOverlap: {
            sharedLabels: ["Java"],
            sharedCount: 1,
          },
          rawSkillOverlap: {
            sharedSkills: ["Java", "Spring Boot"],
            sharedCount: 2,
          },
          commercialBlockers: ["Tarief kandidaat (95) ligt boven max (90)"],
          recommendation: {
            label: "Twijfel",
            confidence: 82,
            reason: "Inhoudelijk sterk, maar commercieel nog niet rond.",
          },
        }}
      />,
    );

    expect(html).toContain("Waarom deze match bestaat");
    expect(html).toContain("Commerciële blockers");
    expect(html).toContain("Twijfel");
  });
});
