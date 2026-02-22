import { StepConfig, Handlers } from "motia";
import { z } from "zod";
import { getJobById } from "../../src/services/jobs";
import {
  listActiveCandidates,
  getCandidatesByIds,
} from "../../src/services/candidates";
import { createMatch } from "../../src/services/matches";
import { computeMatchScore } from "../../src/services/scoring";

export const config = {
  name: "GenerateMatches",
  description: "AI-powered matching van kandidaten aan opdrachten",
  triggers: [
    {
      type: "queue",
      topic: "matches.generate",
      input: z.object({
        jobId: z.string().uuid(),
        candidateIds: z.array(z.string().uuid()).optional(),
        limit: z.number().optional().default(10),
      }),
    },
  ],
  enqueues: [{ topic: "matches.completed" }],
  flows: ["recruitment-pipeline"],
} as const satisfies StepConfig;

export const handler: Handlers<typeof config> = async (
  rawInput,
  { enqueue, logger },
) => {
  const input = rawInput as {
    jobId: string;
    candidateIds?: string[];
    limit?: number;
  };
  const limit = input.limit ?? 10;

  // Stap 1: Opdracht ophalen
  const job = await getJobById(input.jobId);
  if (!job) {
    logger.error(`Opdracht ${input.jobId} niet gevonden`);
    return;
  }

  // Stap 2: Kandidaten ophalen
  const candidates = input.candidateIds?.length
    ? await getCandidatesByIds(input.candidateIds)
    : await listActiveCandidates(200);

  if (candidates.length === 0) {
    logger.warn("Geen kandidaten gevonden voor matching");
    await enqueue({
      topic: "matches.completed",
      data: {
        jobId: input.jobId,
        matchesCreated: 0,
        message: "Geen kandidaten beschikbaar",
      },
    });
    return;
  }

  // Stap 3: Score berekenen en sorteren
  const scored = candidates.map((candidate) => ({
    candidate,
    ...computeMatchScore(job, candidate),
  }));

  scored.sort((a, b) => b.score - a.score);
  const topMatches = scored.slice(0, limit);

  // Stap 4: Matches opslaan
  let matchesCreated = 0;
  const errors: string[] = [];

  for (const match of topMatches) {
    try {
      await createMatch({
        jobId: job.id,
        candidateId: match.candidate.id,
        matchScore: match.score,
        confidence: match.confidence,
        reasoning: match.reasoning,
        model: "rule-based-v1",
      });
      matchesCreated++;
    } catch (err) {
      // Duplicate unique constraint — overslaan, andere fouten loggen
      const errMsg = String(err);
      if (errMsg.includes("unique") || errMsg.includes("duplicate")) {
        logger.warn(`Duplicate match overgeslagen: kandidaat ${match.candidate.id}`);
      } else {
        errors.push(`Kandidaat ${match.candidate.id}: ${errMsg}`);
      }
    }
  }

  // Stap 5: Resultaat enqueuen
  await enqueue({
    topic: "matches.completed",
    data: {
      jobId: input.jobId,
      matchesCreated,
      totalCandidatesScored: candidates.length,
      topScore: topMatches[0]?.score ?? 0,
      errors: errors.length > 0 ? errors : undefined,
    },
  });

  logger.info(
    `Matching klaar: ${matchesCreated} matches aangemaakt voor opdracht ${job.title} (${candidates.length} kandidaten gescoord)`,
  );
};
