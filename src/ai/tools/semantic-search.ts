import { tool } from "ai";
import { z } from "zod";
import { findSimilarJobs } from "@/src/services/embedding";

export const semantischZoeken = tool({
  description:
    "Zoek vacatures op basis van semantische gelijkenis met een beschrijving of profiel. Gebruikt vector embeddings voor intelligente matching.",
  inputSchema: z.object({
    query: z.string().describe("Beschrijving, vaardigheden of profiel om mee te matchen"),
    limit: z.number().int().min(1).max(50).optional().describe("Maximum resultaten (standaard 10)"),
    minScore: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Minimale similarity score 0-1 (standaard 0.5)"),
  }),
  execute: async ({ query, limit, minScore }) => {
    const results = await findSimilarJobs(query, {
      limit: limit ?? 10,
      minScore: minScore ?? 0.5,
    });
    return {
      total: results.length,
      matches: results.map((m) => ({
        id: m.id,
        title: m.title,
        similarity: Math.round(m.similarity * 100) / 100,
      })),
    };
  },
});
