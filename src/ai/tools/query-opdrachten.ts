import { tool } from "ai";
import { z } from "zod";
import { PLATFORMS } from "@/src/lib/helpers";
import { withJobsCanonicalSkills } from "@/src/services/esco";
import type { ListJobsSortBy } from "@/src/services/jobs";
import { searchJobsUnified } from "@/src/services/jobs";

const VALID_CONTRACT_TYPES = ["freelance", "interim", "vast", "opdracht"];

/** Normalize model inputs: strip "alle"/"all", zero rates, invalid values. */
function normalizeParams(params: Record<string, unknown>) {
  const platform = (PLATFORMS as readonly string[]).includes(params.platform as string)
    ? (params.platform as string)
    : undefined;
  const contractType = VALID_CONTRACT_TYPES.includes(params.contractType as string)
    ? (params.contractType as string)
    : undefined;
  const rateMin =
    typeof params.rateMin === "number" && params.rateMin > 0 ? params.rateMin : undefined;
  const RATE_CAP = Number(process.env.RATE_CAP_EUR) || 500;
  const rateMax =
    typeof params.rateMax === "number" && params.rateMax < RATE_CAP ? params.rateMax : undefined;
  const province =
    typeof params.province === "string" &&
    params.province.length > 0 &&
    !/^(alle?|all|any)$/i.test(params.province)
      ? params.province
      : undefined;
  const q =
    typeof params.q === "string" && params.q.trim().length > 0 ? params.q.trim() : undefined;

  const VALID_SORT_OPTIONS: ListJobsSortBy[] = [
    "nieuwste",
    "tarief_hoog",
    "tarief_laag",
    "deadline",
  ];
  const sortBy = VALID_SORT_OPTIONS.includes(params.sortBy as ListJobsSortBy)
    ? (params.sortBy as ListJobsSortBy)
    : undefined;

  const workArrangement = ["hybride", "op_locatie", "remote"].includes(
    params.workArrangement as string,
  )
    ? (params.workArrangement as string)
    : undefined;

  const postedAfter =
    typeof params.postedAfter === "string" && params.postedAfter.length > 0
      ? params.postedAfter
      : undefined;
  const deadlineBefore =
    typeof params.deadlineBefore === "string" && params.deadlineBefore.length > 0
      ? params.deadlineBefore
      : undefined;
  const startDateAfter =
    typeof params.startDateAfter === "string" && params.startDateAfter.length > 0
      ? params.startDateAfter
      : undefined;

  return {
    q,
    platform,
    province,
    rateMin,
    rateMax,
    contractType,
    workArrangement,
    sortBy,
    postedAfter,
    deadlineBefore,
    startDateAfter,
  };
}

export const queryOpdrachten = tool({
  description:
    "Zoek en filter opdrachten (vacatures). Twee modi: (1) Met zoekopdracht → hybrid search (tekst + semantisch). (2) Zonder zoekopdracht → gefilterde lijst. Stuur GEEN rateMin/rateMax/contractType als de gebruiker daar niets specifieks over zegt.",
  inputSchema: z.object({
    q: z.string().optional().describe("Vrije tekst zoekterm (hybrid: titel + semantisch)"),
    platform: z
      .string()
      .optional()
      .describe(`Platform filter: ${PLATFORMS.join(", ")}.`),
    province: z
      .string()
      .optional()
      .describe("Provincie, bijv. Utrecht, Noord-Holland. Laat leeg voor heel NL."),
    rateMin: z
      .number()
      .optional()
      .describe("Minimum uurtarief in EUR. Alleen als de gebruiker dit expliciet noemt."),
    rateMax: z
      .number()
      .optional()
      .describe("Maximum uurtarief in EUR. Alleen als de gebruiker dit expliciet noemt."),
    contractType: z
      .string()
      .optional()
      .describe(
        "Contract type: freelance, interim, vast, opdracht. Alleen als de gebruiker dit expliciet noemt.",
      ),
    workArrangement: z
      .enum(["hybride", "op_locatie", "remote"])
      .optional()
      .describe(
        "Werkvorm: hybride, op_locatie, remote. Alleen als de gebruiker dit expliciet noemt.",
      ),
    postedAfter: z
      .string()
      .optional()
      .describe("Toon alleen vacatures geplaatst NA deze datum (ISO formaat, bijv. 2026-03-01)."),
    deadlineBefore: z
      .string()
      .optional()
      .describe(
        "Toon alleen vacatures met deadline VOOR deze datum (ISO formaat). Gebruik voor urgente/bijna-verlopen vacatures.",
      ),
    startDateAfter: z
      .string()
      .optional()
      .describe("Toon alleen vacatures die starten NA deze datum (ISO formaat)."),
    sortBy: z
      .enum(["nieuwste", "tarief_hoog", "tarief_laag", "deadline", "geplaatst", "startdatum"])
      .optional()
      .describe(
        "Sorteer resultaten: nieuwste (standaard), tarief_hoog, tarief_laag, deadline, geplaatst (publicatiedatum), startdatum.",
      ),
    limit: z.number().optional().default(20).describe("Max resultaten (standaard 20)"),
  }),
  execute: async (params) => {
    const n = normalizeParams(params);
    const result = await searchJobsUnified({
      q: n.q,
      platform: n.platform,
      province: n.province,
      rateMin: n.rateMin,
      rateMax: n.rateMax,
      contractType: n.contractType,
      workArrangement: n.workArrangement,
      sortBy: n.sortBy,
      postedAfter: n.postedAfter,
      deadlineBefore: n.deadlineBefore,
      startDateAfter: n.startDateAfter,
      limit: params.limit ?? 20,
    });
    const dataWithCanonicalSkills = await withJobsCanonicalSkills(result.data);
    const hasScore = result.data.some((j) => "score" in j && typeof j.score === "number");
    return {
      total: result.total,
      opdrachten: dataWithCanonicalSkills.map((job) =>
        hasScore && "score" in job
          ? { ...summarizeJob(job), score: (job as { score: number }).score }
          : summarizeJob(job),
      ),
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
    province: job.province,
    rateMin: job.rateMin,
    rateMax: job.rateMax,
    contractType: job.contractType,
    workArrangement: job.workArrangement,
    applicationDeadline: job.applicationDeadline,
    postedAt: job.postedAt,
    startDate: job.startDate,
    canonicalSkills: job.canonicalSkills,
  };
}
