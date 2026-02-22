import { StepConfig, Handlers } from "motia";
import { z } from "zod";

const generateSchema = z.object({
  jobId: z.string().uuid(),
  candidateIds: z.array(z.string().uuid()).optional(),
  limit: z.number().optional().default(10),
});

export const config = {
  name: "TriggerGenerateMatches",
  description: "HTTP trigger voor AI matching van kandidaten aan opdrachten",
  triggers: [
    {
      type: "http",
      method: "POST",
      path: "/api/matches/genereren",
      input: generateSchema,
    },
  ],
  enqueues: [{ topic: "matches.generate" }],
  flows: ["recruitment-pipeline"],
} as const satisfies StepConfig;

export const handler: Handlers<typeof config> = async (
  req,
  { enqueue, logger },
) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    return {
      status: 400,
      body: { error: "Ongeldige invoer", details: parsed.error.flatten() },
    };
  }

  try {
    await enqueue({
      topic: "matches.generate",
      data: {
        jobId: parsed.data.jobId,
        candidateIds: parsed.data.candidateIds,
        limit: parsed.data.limit,
      },
    });

    logger.info(
      `Match generatie gestart voor opdracht ${parsed.data.jobId}`,
    );

    return {
      status: 202,
      body: {
        message: "Match generatie gestart",
        jobId: parsed.data.jobId,
        candidateCount: parsed.data.candidateIds?.length ?? "alle",
        limit: parsed.data.limit,
      },
    };
  } catch (err) {
    logger.error(`Fout bij starten match generatie: ${String(err)}`);
    return {
      status: 500,
      body: { error: "Interne serverfout" },
    };
  }
};
