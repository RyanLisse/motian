import { tool } from "ai";
import { z } from "zod";
import { listJobs, hybridSearch } from "@/src/services/jobs";

const VALID_CONTRACT_TYPES = ["freelance", "interim", "vast", "opdracht"];
const VALID_PLATFORMS = ["flextender", "striive", "opdrachtoverheid"];

/** Normalize model inputs: strip "alle"/"all", zero rates, invalid values. */
function normalizeParams(params: Record<string, unknown>) {
  const platform = VALID_PLATFORMS.includes(params.platform as string)
    ? (params.platform as string)
    : undefined;
  const contractType = VALID_CONTRACT_TYPES.includes(params.contractType as string)
    ? (params.contractType as string)
    : undefined;
  const rateMin =
    typeof params.rateMin === "number" && params.rateMin > 0
      ? params.rateMin
      : undefined;
  const rateMax =
    typeof params.rateMax === "number" && params.rateMax < 500
      ? params.rateMax
      : undefined;
  const province =
    typeof params.province === "string" &&
    params.province.length > 0 &&
    !/^(alle?|all|any)$/i.test(params.province)
      ? params.province
      : undefined;
  const q =
    typeof params.q === "string" && params.q.trim().length > 0
      ? params.q.trim()
      : undefined;

  return { q, platform, province, rateMin, rateMax, contractType };
}

export const queryOpdrachten = tool({
  description:
    "Zoek en filter opdrachten (vacatures). Gebruikt hybrid search (tekst + semantisch) voor slim zoeken. Gebruik dit om opdrachten te vinden op basis van zoekopdracht, platform, provincie, tarief, etc. Stuur GEEN rateMin/rateMax/contractType als de gebruiker daar niets specifieks over zegt.",
  inputSchema: z.object({
    q: z.string().optional().describe("Vrije tekst zoekterm (hybrid: titel + semantisch)"),
    platform: z
      .string()
      .optional()
      .describe("Platform filter: flextender, striive, opdrachtoverheid. Laat leeg voor alle platforms."),
    province: z.string().optional().describe("Provincie, bijv. Utrecht, Noord-Holland. Laat leeg voor heel NL."),
    rateMin: z.number().optional().describe("Minimum uurtarief in EUR. Alleen als de gebruiker dit expliciet noemt."),
    rateMax: z.number().optional().describe("Maximum uurtarief in EUR. Alleen als de gebruiker dit expliciet noemt."),
    contractType: z
      .string()
      .optional()
      .describe("Contract type: freelance, interim, vast, opdracht. Alleen als de gebruiker dit expliciet noemt."),
    limit: z.number().optional().default(20).describe("Max resultaten (standaard 20)"),
  }),
  execute: async (params) => {
    const n = normalizeParams(params);

    // Always use hybrid search when text query is present
    if (n.q) {
      const results = await hybridSearch(n.q, {
        limit: params.limit ?? 20,
        platform: n.platform,
        province: n.province,
        rateMin: n.rateMin,
        rateMax: n.rateMax,
        contractType: n.contractType,
      });
      return {
        total: results.length,
        opdrachten: results.map((job) => ({
          ...summarizeJob(job),
          score: job.score,
        })),
      };
    }

    // No text query — use filtered listing
    const { data, total } = await listJobs({
      platform: n.platform,
      province: n.province,
      rateMin: n.rateMin,
      rateMax: n.rateMax,
      contractType: n.contractType,
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
