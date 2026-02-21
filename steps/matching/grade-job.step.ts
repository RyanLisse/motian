import { StepConfig, Handlers } from "motia";
import { z } from "zod";
import { getMatchById } from "../../src/services/matches";
import { getCandidateById } from "../../src/services/candidates";
import { getJobById } from "../../src/services/jobs";
import { getAIModel, type MatchResult } from "../../src/services/ai";
import { db } from "../../src/db";
import { jobMatches } from "../../src/db/schema";
import { eq } from "drizzle-orm";
import { complete } from "@mariozechner/pi-ai";

export const config = {
  name: "GradeJob",
  description:
    "LLM reranking van matches — berekent overallScore via AI",
  triggers: [
    {
      type: "queue",
      topic: "match.grade",
      input: z.object({
        candidateId: z.string(),
        matchIds: z.array(z.string()),
      }),
    },
  ],
  enqueues: [{ topic: "match.completed" }],
  flows: ["recruitment-matching"],
} as const satisfies StepConfig;

// ========== Handler ==========

export const handler: Handlers<typeof config> = async (
  rawInput,
  { enqueue, logger },
) => {
  const input = rawInput as {
    candidateId: string;
    matchIds: string[];
  };

  const ai = await getAIModel();
  if (!ai) {
    logger.error(
      "Geen AI credentials geconfigureerd — kan niet graden. Run: npx @mariozechner/pi-ai login anthropic",
    );
    return;
  }

  const candidate = await getCandidateById(input.candidateId);
  if (!candidate) {
    logger.error(`Kandidaat ${input.candidateId} niet gevonden`);
    return;
  }

  let graded = 0;

  for (const matchId of input.matchIds) {
    const match = await getMatchById(matchId);
    if (!match) {
      logger.warn(`Match ${matchId} niet gevonden, overslaan`);
      continue;
    }

    const job = await getJobById(match.jobId);
    if (!job) {
      logger.warn(`Job ${match.jobId} niet gevonden voor match ${matchId}, overslaan`);
      continue;
    }

    // Build LLM prompt (Dutch, matching app/api/match/route.ts pattern)
    const prompt = `Je bent een expert recruitment AI die kandidaten matcht aan opdrachten voor een Nederlands recruitmentbureau (Motian).

Analyseer de volgende kandidaat en opdracht en geef een gedetailleerd match rapport.

## Kandidaat
- Naam: ${candidate.name}
- Rol: ${candidate.role ?? "Onbekend"}
- Ervaring: ${candidate.experience ?? "Onbekend"}
- Locatie: ${candidate.location ?? "Onbekend"}
- Skills: ${Array.isArray(candidate.skills) ? (candidate.skills as string[]).join(", ") : "geen"}
- Tags: ${Array.isArray(candidate.tags) ? (candidate.tags as string[]).join(", ") : "geen"}

## Opdracht
- Titel: ${job.title}
- Bedrijf: ${job.company ?? "Onbekend"}
- Locatie: ${job.location ?? "Onbekend"}
- Contracttype: ${job.contractType ?? "Onbekend"}
- Werkregeling: ${job.workArrangement ?? "Onbekend"}
- Beschrijving: ${job.description?.slice(0, 2000) ?? "Geen beschrijving"}
- Eisen: ${Array.isArray(job.requirements) ? (job.requirements as { description?: string }[]).map((r) => r.description ?? String(r)).join(", ") : "geen"}
- Wensen: ${Array.isArray(job.wishes) ? (job.wishes as { description?: string }[]).map((w) => w.description ?? String(w)).join(", ") : "geen"}
- Competenties: ${Array.isArray(job.competences) ? (job.competences as string[]).join(", ") : "geen"}

## Instructies
1. Evalueer knock-out criteria (harde vereisten: minimaal 3 jaar ervaring, elke vereiste skill, locatie compatibiliteit)
2. Score op 5 dimensies: Technische Skills (30%), Ervaring (25%), Probleemoplossend vermogen (20%), Communicatie (15%), Culturele Fit (10%)
3. Bereken een overall score (0-100) gebaseerd op gewogen scores
4. Bepaal risicoprofiel (Laag/Gemiddeld/Hoog)
5. Geef 3 concrete aanbevelingen in het Nederlands
6. Schrijf een korte samenvatting in het Nederlands

Wees realistisch en eerlijk in je beoordeling. Gebruik bewijs uit het kandidaatprofiel.

Antwoord ALLEEN met een geldig JSON object in exact dit formaat (geen markdown, geen uitleg, alleen JSON):
{
  "overallScore": <number 0-100>,
  "knockOutCriteria": [{"criterion": "...", "required": true/false, "met": true/false, "evidence": "..."}],
  "scoringCriteria": [{"criterion": "...", "weight": <number>, "score": <number 1-5>, "explanation": "..."}],
  "riskLevel": "Laag" | "Gemiddeld" | "Hoog",
  "riskExplanation": "...",
  "recommendations": ["...", "...", "..."],
  "matchedSkills": ["...", "..."],
  "missingSkills": ["...", "..."],
  "summary": "..."
}`;

    try {
      const response = await complete(
        ai.model,
        {
          messages: [
            { role: "user", content: prompt, timestamp: Date.now() },
          ],
        },
        {
          maxTokens: 4096,
          temperature: 0.3,
          ...(ai.apiKey ? { apiKey: ai.apiKey } : {}),
        },
      );

      // Extract text from response content
      const text = response.content
        .filter(
          (c): c is { type: "text"; text: string } => c.type === "text",
        )
        .map((c) => c.text)
        .join("");

      // Parse JSON from response (strip markdown fences if present)
      const jsonStr = text
        .replace(/^```(?:json)?\s*/, "")
        .replace(/\s*```$/, "")
        .trim();
      const result: MatchResult = JSON.parse(jsonStr);

      // Calculate weighted llmScore from scoringCriteria
      const totalWeight = result.scoringCriteria.reduce((sum, c) => sum + c.weight, 0);
      const llmScore = totalWeight > 0
        ? result.scoringCriteria.reduce((sum, c) => sum + c.weight * c.score, 0) / totalWeight
        : 0;
      const llmScoreNormalized = (llmScore / 5) * 100; // Normalize 1-5 scale to 0-100

      // Check if all required knock-out criteria are met
      const knockOutPassed = result.knockOutCriteria
        .filter((k) => k.required)
        .every((k) => k.met);

      // Update the match record in DB
      await db
        .update(jobMatches)
        .set({
          llmScore: llmScoreNormalized,
          overallScore: result.overallScore,
          knockOutPassed,
          matchData: result as unknown as Record<string, unknown>,
        })
        .where(eq(jobMatches.id, matchId));

      graded++;
    } catch (err) {
      logger.error(
        `LLM grading mislukt voor match ${matchId}: ${String(err)}`,
      );
    }
  }

  // Enqueue completion event
  await enqueue({
    topic: "match.completed",
    data: {
      candidateId: input.candidateId,
      graded,
    },
  });

  logger.info(
    `GradeJob klaar: ${graded}/${input.matchIds.length} matches gegraded voor kandidaat ${input.candidateId}`,
  );
};
