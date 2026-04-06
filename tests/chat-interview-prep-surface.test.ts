import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InterviewPrepCard } from "@/components/chat/genui/interview-prep-card";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]) {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf8");
}

describe("interview prep chat surface", () => {
  it("renders the clarification state in Dutch", () => {
    const html = renderToStaticMarkup(
      createElement(InterviewPrepCard, {
        output: {
          status: "needs_clarification",
          missingInformation: ["interviewtype", "gespreksdoel"],
          recommendedQuestions: [
            "Welk type gesprek is dit precies?",
            "Wat moet dit gesprek vooral uitwijzen?",
            "Welke risico's wil je expliciet toetsen?",
          ],
          nextStep:
            "Vraag eerst 3-5 verduidelijkende vragen, vat de antwoorden kort samen en genereer daarna pas de interviewvoorbereiding.",
        },
      }),
    );

    expect(html).toContain("Eerst verduidelijken");
    expect(html).toContain("interviewtype");
    expect(html).toContain("Welk type gesprek is dit precies?");
  });

  it("renders the ready state with scorecard and writeback payload", () => {
    const html = renderToStaticMarkup(
      createElement(InterviewPrepCard, {
        output: {
          status: "ready",
          artifact: {
            prepSummary: {
              interviewType: "screening",
              interviewGoal: "Toets sourcingdiepgang en stakeholderfit",
              recommendedDuration: "30 minuten",
              contextSummary: "Senior Recruiter bij Motian met matchscore 72%.",
            },
            openingPrompt: "Bedank de kandidaat en schets kort de focus van het gesprek.",
            mustAskQuestions: [
              "Kunt u uw sourcing-aanpak toelichten?",
              "Hoe stemt u met hiring managers af?",
              "Hoe prioriteert u vacatures?",
              "Welke signalen gebruikt u om risico te zien?",
            ],
            scorecardCriteria: [
              {
                criterion: "Sourcingdiepgang",
                whatGoodLooksLike: "Concreet proces met metrics",
                redFlag: "Geen eigen aanpak",
              },
              {
                criterion: "Stakeholdermanagement",
                whatGoodLooksLike: "Beschrijft alignment en escalatie",
                redFlag: "Geen voorbeelden van samenwerking",
              },
              {
                criterion: "Tempo en prioritering",
                whatGoodLooksLike: "Kan trade-offs helder uitleggen",
                redFlag: "Onhelder over keuzes",
              },
            ],
            evidenceToCapture: ["Concrete sourcingmetrics", "Beschikbaarheid", "Tariefverwachting"],
            recruiterNotes: [
              "Check of sourcingvoorbeelden echt eigen werk zijn.",
              "Let op stakeholderconflicten.",
              "Valideer beschikbaarheid tegen vacaturedruk.",
            ],
            humanGuardrails: [
              "AI vat alleen samen en adviseert.",
              "Hiring-beslissingen blijven menselijk.",
              "Eindbeoordeling wordt niet door AI vastgesteld.",
            ],
            writebackPayload: {
              type: "interview_prep_template",
              interviewType: "screening",
              linkedJobId: "job-1",
              linkedCandidateId: "cand-1",
              linkedMatchId: "match-1",
              mustAskQuestions: ["Kunt u uw sourcing-aanpak toelichten?"],
              evidenceToCapture: ["Concrete sourcingmetrics"],
            },
          },
        },
      }),
    );

    expect(html).toContain("Interviewprep: screening");
    expect(html).toContain("Scorecardcriteria");
    expect(html).toContain("Writeback payload");
    expect(html).toContain("Recruiter-ready");
  });

  it("registers the GenUI card and keeps screening question discoverability in chat", () => {
    const registrySource = readFile("components", "chat", "genui", "registry.ts");
    const chatPageSource = readFile("components", "chat", "chat-page-content.tsx");

    expect(registrySource).toContain("genereerInterviewPrep");
    expect(registrySource).toContain('import("./interview-prep-card")');

    expect(chatPageSource).toContain("Maak screeningvragen");
    expect(chatPageSource).toContain("Schrijf 5 screeningvragen voor kandidaten op deze opdracht.");
  });
});
