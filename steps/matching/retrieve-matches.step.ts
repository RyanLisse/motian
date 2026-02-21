import { StepConfig, Handlers } from "motia";
import { z } from "zod";
import { getCandidateById } from "../../src/services/candidates";
import {
  findSimilarJobs,
  deserializeEmbedding,
} from "../../src/services/embeddings";
import { createMatch } from "../../src/services/matches";

export const config = {
  name: "RetrieveMatches",
  description:
    "Vind top-K matches voor een kandidaat via cosine similarity",
  triggers: [
    {
      type: "queue",
      topic: "match.request",
      input: z.object({
        candidateId: z.string(),
        limit: z.number().default(20),
      }),
    },
  ],
  enqueues: [{ topic: "match.grade" }],
  flows: ["recruitment-matching"],
} as const satisfies StepConfig;

export const handler: Handlers<typeof config> = async (
  rawInput,
  { enqueue, logger },
) => {
  const input = rawInput as { candidateId: string; limit: number };

  // Stap 1: Haal kandidaat op
  const candidate = await getCandidateById(input.candidateId);
  if (!candidate) {
    logger.error(`Kandidaat ${input.candidateId} niet gevonden`);
    return;
  }

  if (!candidate.embedding) {
    logger.error(
      `Kandidaat ${input.candidateId} heeft geen embedding — kan niet matchen`,
    );
    return;
  }

  // Stap 2: Deserialiseer embedding en zoek vergelijkbare jobs
  const embedding = deserializeEmbedding(candidate.embedding);
  const similarJobs = await findSimilarJobs(embedding, input.limit);

  // Stap 3: Maak match records aan
  const matchIds: string[] = [];
  for (const { jobId, score } of similarJobs) {
    const match = await createMatch({
      jobId,
      candidateId: input.candidateId,
      vectorScore: score,
    });
    matchIds.push(match.id);
  }

  // Stap 4: Enqueue voor LLM grading
  await enqueue({
    topic: "match.grade",
    data: {
      candidateId: input.candidateId,
      matchIds,
    },
  });

  logger.info(
    `RetrieveMatches klaar: ${matchIds.length} matches gevonden voor kandidaat ${input.candidateId}`,
  );
};
