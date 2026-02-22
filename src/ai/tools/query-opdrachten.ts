import { tool } from "ai";
import { z } from "zod";
import { listJobs, searchJobsByTitle } from "@/src/services/jobs";

export const queryOpdrachten = tool({
  description:
    "Zoek en filter opdrachten (vacatures). Gebruik dit om opdrachten te vinden op basis van zoekopdracht, platform, provincie, tarief, etc.",
  inputSchema: z.object({
    q: z.string().optional().describe("Vrije tekst zoekterm voor titel"),
    platform: z
      .string()
      .optional()
      .describe("Platform filter: flextender, striive, opdrachtoverheid"),
    province: z.string().optional().describe("Provincie, bijv. Utrecht, Noord-Holland"),
    rateMin: z.number().optional().describe("Minimum uurtarief in EUR"),
    rateMax: z.number().optional().describe("Maximum uurtarief in EUR"),
    contractType: z
      .string()
      .optional()
      .describe("Contract type: freelance, interim, vast, opdracht"),
    limit: z.number().optional().default(20).describe("Max resultaten (standaard 20)"),
  }),
  execute: async (params) => {
    // If only a text query, use the title search for speed
    if (params.q && !params.platform && !params.province && !params.rateMin && !params.rateMax && !params.contractType) {
      const results = await searchJobsByTitle(params.q, params.limit);
      return {
        total: results.length,
        opdrachten: results.map(summarizeJob),
      };
    }

    const { data, total } = await listJobs({
      q: params.q,
      platform: params.platform,
      province: params.province,
      rateMin: params.rateMin,
      rateMax: params.rateMax,
      contractType: params.contractType,
      limit: params.limit,
    });

    return {
      total,
      opdrachten: data.map(summarizeJob),
    };
  },
});

/** Strip heavy fields to keep tool output small for the model context. */
function summarizeJob(job: Record<string, unknown>) {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    platform: job.platform,
    location: job.location,
    rateMin: job.rateMin,
    rateMax: job.rateMax,
    contractType: job.contractType,
    applicationDeadline: job.applicationDeadline,
  };
}
