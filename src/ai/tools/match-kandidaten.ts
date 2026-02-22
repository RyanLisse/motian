import { tool } from "ai";
import { z } from "zod";
import { findSimilarJobs } from "@/src/services/embedding";

export const matchKandidaten = tool({
  description:
    "Zoek opdrachten die semantisch vergelijkbaar zijn met een beschrijving. Gebruikt vector embeddings voor intelligente matching. Goed voor: 'zoek opdrachten vergelijkbaar met Java backend developer'.",
  inputSchema: z.object({
    query: z
      .string()
      .describe("Beschrijving van het profiel of de opdracht om op te matchen"),
    limit: z.number().optional().default(10).describe("Max resultaten"),
    minScore: z
      .number()
      .optional()
      .default(0.5)
      .describe("Minimale similarity score (0-1)"),
  }),
  execute: async ({ query, limit, minScore }) => {
    const matches = await findSimilarJobs(query, { limit, minScore });
    return {
      total: matches.length,
      matches: matches.map((m) => ({
        id: m.id,
        title: m.title,
        similarity: Math.round(m.similarity * 100) / 100,
      })),
    };
  },
});
