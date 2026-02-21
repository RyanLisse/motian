import { StepConfig, Handlers } from "motia";
import { z } from "zod";

export const config = {
  name: "StageChange",
  description: "Log sollicitatie stage wijzigingen en trigger notificaties",
  triggers: [
    {
      type: "queue",
      topic: "application.stage.changed",
      input: z.object({
        applicationId: z.string(),
        previousStage: z.string().nullable(),
        newStage: z.string(),
        changedBy: z.string().optional(),
      }),
    },
  ],
  enqueues: [{ topic: "pipeline.stage.logged" }],
  flows: ["recruitment-pipeline"],
} as const satisfies StepConfig;

export const handler: Handlers<typeof config> = async (
  rawInput,
  { enqueue, logger },
) => {
  const input = rawInput as {
    applicationId: string;
    previousStage: string | null;
    newStage: string;
    changedBy?: string;
  };

  logger.info(
    `Stage wijziging: ${input.previousStage ?? "geen"} → ${input.newStage} voor sollicitatie ${input.applicationId}`,
  );

  await enqueue({
    topic: "pipeline.stage.logged",
    data: {
      applicationId: input.applicationId,
      previousStage: input.previousStage,
      newStage: input.newStage,
      timestamp: new Date().toISOString(),
    },
  });

  logger.info(
    `Pipeline stage gelogd voor sollicitatie ${input.applicationId}`,
  );
};
