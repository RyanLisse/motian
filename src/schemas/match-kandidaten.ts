import { z } from "zod";

export const matchKandidatenRunQuerySchema = z.object({
  runId: z
    .string({ required_error: "runId is verplicht" })
    .min(1, "runId is verplicht")
    .regex(/^run_[A-Za-z0-9]+$/, "runId moet een geldig Trigger.dev run ID zijn"),
});

export type MatchKandidatenRunQuery = z.infer<typeof matchKandidatenRunQuerySchema>;
