import { revalidatePath } from "next/cache";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { publish } from "../../lib/event-bus.js";
import { autoMatchJobToCandidates } from "../../services/auto-matching.js";
import { withJobCanonicalSkills, withJobsCanonicalSkills } from "../../services/esco.js";
import type { ListJobsSortBy } from "../../services/jobs.js";
import { deleteJob, getJobById, searchJobsUnified, updateJob } from "../../services/jobs.js";

// ========== Schemas ==========

const zoekVacaturesSchema = z.object({
  query: z
    .string()
    .optional()
    .describe("Zoekterm voor titel, bedrijf of omschrijving (hybrid: tekst + semantisch)"),
  platform: z
    .string()
    .optional()
    .describe("Filter op platform (bijv. 'striive', 'flextender', 'opdrachtoverheid')"),
  province: z.string().optional().describe("Provincie filter, bijv. 'Utrecht', 'Noord-Holland'"),
  rateMin: z.number().optional().describe("Minimum uurtarief in EUR"),
  rateMax: z.number().optional().describe("Maximum uurtarief in EUR"),
  contractType: z.string().optional().describe("Contract type: freelance, interim, vast, opdracht"),
  workArrangement: z.string().optional().describe("Werkvorm: hybride, op_locatie, remote"),
  postedAfter: z.string().optional().describe("Vacatures geplaatst na deze datum (ISO formaat)"),
  deadlineBefore: z
    .string()
    .optional()
    .describe("Vacatures met deadline voor deze datum (ISO formaat)"),
  startDateAfter: z
    .string()
    .optional()
    .describe("Vacatures die starten na deze datum (ISO formaat)"),
  sortBy: z
    .enum(["nieuwste", "tarief_hoog", "tarief_laag", "deadline", "geplaatst", "startdatum"])
    .optional()
    .describe(
      "Sortering: nieuwste (standaard), tarief_hoog, tarief_laag, deadline, geplaatst, startdatum",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Maximum aantal resultaten (standaard 50)"),
  offset: z.number().int().min(0).optional().describe("Offset voor paginering"),
});

const vacatureDetailSchema = z.object({
  id: z.string().uuid().describe("UUID van de vacature"),
});

const updateVacatureSchema = z.object({
  id: z.string().uuid().describe("UUID van de vacature"),
  title: z.string().optional().describe("Functietitel"),
  description: z.string().optional().describe("Omschrijving van de vacature"),
  location: z.string().optional().describe("Locatie"),
  rateMin: z.number().optional().describe("Minimaal uurtarief in euro"),
  rateMax: z.number().optional().describe("Maximaal uurtarief in euro"),
  contractType: z.string().optional().describe("Type contract (bijv. 'freelance', 'vast')"),
  workArrangement: z.string().optional().describe("Werkvorm (bijv. 'remote', 'hybrid', 'onsite')"),
});

const verwijderVacatureSchema = z.object({
  id: z.string().uuid().describe("UUID van de vacature"),
});

const autoMatchVacatureSchema = z.object({
  jobId: z.string().uuid().describe("UUID van de vacature om te matchen"),
});

// ========== Tool Definitions ==========

export const tools = [
  {
    name: "zoek_vacatures",
    description:
      "Zoek en filter vacatures. Met zoekterm: hybrid search (tekst + semantisch). Zonder: gefilterde lijst. Ondersteunt sortering op tarief, datum en deadline.",
    inputSchema: zodToJsonSchema(zoekVacaturesSchema, { $refStrategy: "none" }),
  },
  {
    name: "vacature_detail",
    description: "Haal volledige details op van een vacature op basis van UUID.",
    inputSchema: zodToJsonSchema(vacatureDetailSchema, { $refStrategy: "none" }),
  },
  {
    name: "update_vacature",
    description: "Werk een bestaande vacature bij. Geef het UUID en de te wijzigen velden mee.",
    inputSchema: zodToJsonSchema(updateVacatureSchema, { $refStrategy: "none" }),
  },
  {
    name: "verwijder_vacature",
    description: "Archiveer een vacature zonder deze uit de database te verwijderen.",
    inputSchema: zodToJsonSchema(verwijderVacatureSchema, { $refStrategy: "none" }),
  },
  {
    name: "auto_match_vacature",
    description:
      "Match een vacature automatisch met de best passende kandidaten (top 3). Gebruikt AI-scoring en deep matching.",
    inputSchema: zodToJsonSchema(autoMatchVacatureSchema, { $refStrategy: "none" }),
  },
];

// ========== Handlers ==========

export const handlers: Record<string, (args: unknown) => Promise<unknown>> = {
  zoek_vacatures: async (raw) => {
    const opts = zoekVacaturesSchema.parse(raw);
    const result = await searchJobsUnified({
      q: opts.query?.trim() || undefined,
      platform: opts.platform,
      province: opts.province,
      rateMin: opts.rateMin,
      rateMax: opts.rateMax,
      contractType: opts.contractType,
      workArrangement: opts.workArrangement,
      sortBy: opts.sortBy as ListJobsSortBy | undefined,
      postedAfter: opts.postedAfter,
      deadlineBefore: opts.deadlineBefore,
      startDateAfter: opts.startDateAfter,
      limit: opts.limit,
      offset: opts.offset,
    });
    const vacatures = await withJobsCanonicalSkills(result.data);
    return { total: result.total, vacatures };
  },

  vacature_detail: async (raw) => {
    const { id } = vacatureDetailSchema.parse(raw);
    const result = await getJobById(id);
    if (!result) return { error: "Vacature niet gevonden" };
    return withJobCanonicalSkills(result);
  },

  update_vacature: async (raw) => {
    const { id, ...data } = updateVacatureSchema.parse(raw);
    const result = await updateJob(id, data);
    if (!result) return { error: "Vacature niet gevonden" };
    revalidatePath("/vacatures");
    revalidatePath(`/vacatures/${id}`);
    publish("job:updated", { id });
    return withJobCanonicalSkills(result);
  },

  verwijder_vacature: async (raw) => {
    const { id } = verwijderVacatureSchema.parse(raw);
    const deleted = await deleteJob(id);
    if (!deleted) return { error: "Vacature niet gevonden of al gearchiveerd" };
    revalidatePath("/vacatures");
    revalidatePath("/overzicht");
    publish("job:deleted", { id });
    return { success: true, message: "Vacature gearchiveerd" };
  },

  auto_match_vacature: async (raw) => {
    const { jobId } = autoMatchVacatureSchema.parse(raw);
    return autoMatchJobToCandidates(jobId);
  },
};
