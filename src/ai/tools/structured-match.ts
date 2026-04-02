import { tool } from "ai";
import { z } from "zod";
import { runStructuredMatchForIds } from "@/src/services/structured-matching";

export const voerStructuredMatchUit = tool({
  description:
    "Voer een diepgaande gestructureerde matching uit (Mariënne-methodologie). Evalueert een kandidaat tegen alle eisen van een vacature met knock-out criteria, gunningscriteria en een eindbeoordeling.",
  inputSchema: z.object({
    jobId: z.string().uuid().describe("UUID van de vacature"),
    candidateId: z.string().uuid().describe("UUID van de kandidaat"),
  }),
  execute: async ({ jobId, candidateId }) => {
    try {
      return await runStructuredMatchForIds(jobId, candidateId);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Onbekende fout bij gestructureerde matching";
      return { error: message };
    }
  },
});
