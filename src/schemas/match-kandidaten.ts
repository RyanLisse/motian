import { z } from "zod";

export const matchKandidatenRunQuerySchema = z.object({
  runId: z.string({ error: "runId is verplicht" }).uuid("runId moet een geldige UUID zijn"),
});

export type MatchKandidatenRunQuery = z.infer<typeof matchKandidatenRunQuerySchema>;
