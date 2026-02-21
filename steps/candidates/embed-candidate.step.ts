import { StepConfig, Handlers } from "motia";
import { z } from "zod";
import {
  getCandidateById,
  updateCandidate,
} from "../../src/services/candidates";
import {
  generateEmbedding,
  buildCandidateEmbeddingText,
  serializeEmbedding,
} from "../../src/services/embeddings";

export const config = {
  name: "EmbedCandidate",
  description: "Genereer embedding voor een nieuwe kandidaat",
  triggers: [
    {
      type: "queue",
      topic: "candidate.created",
      input: z.object({
        candidateId: z.string(),
      }),
    },
  ],
  enqueues: [{ topic: "candidate.embedded" }],
  flows: ["recruitment-matching"],
} as const satisfies StepConfig;

export const handler: Handlers<typeof config> = async (
  rawInput,
  { enqueue, logger },
) => {
  const input = rawInput as {
    candidateId: string;
  };

  // Fetch candidate
  const candidate = await getCandidateById(input.candidateId);
  if (!candidate) {
    logger.error(`Kandidaat niet gevonden: ${input.candidateId}`);
    return;
  }

  // Build embedding text and generate vector
  const text = buildCandidateEmbeddingText(candidate);
  const embedding = await generateEmbedding(text);

  if (embedding === null) {
    logger.warn(
      "Geen OpenAI API key beschikbaar, embedding generatie overgeslagen",
    );
    return;
  }

  // Persist embedding
  await updateCandidate(input.candidateId, {
    embedding: serializeEmbedding(embedding),
  });

  await enqueue({
    topic: "candidate.embedded",
    data: { candidateId: input.candidateId },
  });

  logger.info(`Embedding gegenereerd voor kandidaat ${candidate.name}`);
};
