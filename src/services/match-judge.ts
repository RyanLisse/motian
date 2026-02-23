import { xai } from "@ai-sdk/xai";
import { generateText, Output } from "ai";
import { z } from "zod";
import { withRetry } from "../lib/retry";
import type { StructuredMatchOutput } from "../schemas/matching";

// ========== Config ==========

const JUDGE_MODEL = xai("grok-4-1-fast-reasoning");

// ========== Schema ==========

const judgeVerdictSchema = z.object({
  agreement: z
    .enum(["agree", "disagree", "partial"])
    .describe("Whether the judge agrees with the original recommendation"),
  adjustedScore: z
    .number()
    .min(0)
    .max(100)
    .describe("The judge's own assessment of the overall match score"),
  adjustedRecommendation: z
    .enum(["go", "no-go", "conditional"])
    .describe("The judge's own recommendation"),
  confidence: z.number().min(0).max(100).describe("How confident the judge is in this assessment"),
  reasoning: z.string().describe("Brief explanation of the judge's verdict — 2-3 sentences max"),
  redFlags: z
    .array(z.string())
    .describe("Any concerns the judge spotted that the original evaluation missed"),
});

export type JudgeVerdict = z.infer<typeof judgeVerdictSchema>;

// ========== System Prompt ==========

const JUDGE_SYSTEM_PROMPT = `Je bent een onafhankelijke recruitment-expert die als "judge" optreedt.
Je beoordeelt een eerder gemaakte match-analyse tussen een kandidaat en een vacature.

Je taak:
1. Lees de originele beoordeling kritisch
2. Beoordeel of de recommendation (go/no-go/conditional) correct is
3. Kijk of er bewijslacunes zijn (bewijs dat niet overtuigend is)
4. Geef je eigen onafhankelijke score en aanbeveling
5. Markeer rode vlaggen die de originele beoordeling miste

Wees streng maar eerlijk. Een "go" verdient alleen een kandidaat die echt goed past.
Bij twijfel: kies "conditional" boven "go".

Antwoord in het Nederlands.`;

// ========== Judge Function ==========

/**
 * Run a Grok-powered independent judge on a structured match result.
 * Returns a verdict with agreement level, adjusted score, and reasoning.
 *
 * This is non-blocking and non-fatal — if the judge fails, the original
 * result is used as-is.
 */
export async function judgeMatch(input: {
  jobTitle: string;
  candidateName: string;
  cvSummary: string;
  structuredResult: StructuredMatchOutput;
}): Promise<JudgeVerdict | null> {
  try {
    const prompt = buildJudgePrompt(input);

    const { output } = await withRetry(
      () =>
        generateText({
          model: JUDGE_MODEL,
          output: Output.object({ schema: judgeVerdictSchema }),
          system: JUDGE_SYSTEM_PROMPT,
          prompt,
        }),
      { label: "Match Judge (Grok)" },
    );

    return output as JudgeVerdict;
  } catch (err) {
    console.error("[Match Judge] Grok judge failed (non-fatal):", err);
    return null;
  }
}

// ========== Prompt Builder ==========

function buildJudgePrompt(input: {
  jobTitle: string;
  candidateName: string;
  cvSummary: string;
  structuredResult: StructuredMatchOutput;
}): string {
  const sr = input.structuredResult;

  const knockouts = sr.criteriaBreakdown
    .filter((c) => c.tier === "knockout")
    .map(
      (c) => `  - ${c.criterion}: ${c.passed ? "✅ Voldaan" : "❌ Niet voldaan"} — ${c.evidence}`,
    )
    .join("\n");

  const gunning = sr.criteriaBreakdown
    .filter((c) => c.tier === "gunning")
    .map(
      (c) =>
        `  - ${c.criterion}: ${"★".repeat(c.stars ?? 0)}${"☆".repeat(5 - (c.stars ?? 0))} — ${c.evidence}`,
    )
    .join("\n");

  return `## Vacature: ${input.jobTitle}
## Kandidaat: ${input.candidateName}

## CV samenvatting:
${input.cvSummary.slice(0, 2000)}

## Originele beoordeling:
- Overall score: ${sr.overallScore}/100
- Knock-outs allemaal gehaald: ${sr.knockoutsPassed ? "Ja" : "Nee"}
- Aanbeveling: ${sr.recommendation}
- Redenering: ${sr.recommendationReasoning}
- Vertrouwen: ${sr.recommendationConfidence}%

### Knock-out criteria:
${knockouts || "  Geen knock-out criteria beoordeeld"}

### Gunningscriteria:
${gunning || "  Geen gunningscriteria beoordeeld"}

### Risicoprofiel:
${sr.riskProfile.length > 0 ? sr.riskProfile.map((r) => `  - ${r}`).join("\n") : "  Geen risico's geïdentificeerd"}

Geef je onafhankelijke oordeel.`;
}
