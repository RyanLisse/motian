import { tool } from "ai";
import { z } from "zod";
import { withJobCanonicalSkills } from "@/src/services/esco";
import { getActivePipelineCount, getJobById } from "@/src/services/jobs";

export const getOpdrachtDetail = tool({
  description:
    "Haal volledige details op van één opdracht op basis van ID. Gebruik dit wanneer de gebruiker meer wil weten over een specifieke opdracht.",
  inputSchema: z.object({
    id: z.string().uuid().describe("UUID van de opdracht"),
  }),
  execute: async ({ id }) => {
    const job = await getJobById(id);
    if (!job) return { error: "Opdracht niet gevonden" };

    // Fetch canonical skills and active pipeline count in parallel
    const [jobWithCanonicalSkills, pipelineCount] = await Promise.all([
      withJobCanonicalSkills(job),
      getActivePipelineCount(id),
    ]);

    // Return rich detail, excluding rawPayload and embedding (too large)
    const { rawPayload, embedding, ...detail } = jobWithCanonicalSkills;
    return {
      ...detail,
      pipelineCount,
    };
  },
});
