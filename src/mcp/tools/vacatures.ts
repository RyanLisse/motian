import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { autoMatchJobToCandidates } from "../../services/auto-matching.js";
import {
  deleteJob,
  getJobById,
  listJobs,
  searchJobsByTitle,
  updateJob,
} from "../../services/jobs.js";

// ========== Schemas ==========

const zoekVacaturesSchema = z.object({
  query: z.string().optional().describe("Zoekterm voor titel, bedrijf of omschrijving"),
  platform: z.string().optional().describe("Filter op platform (bijv. 'huxley', 'yacht')"),
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
      "Zoek vacatures op titel, bedrijf of omschrijving. Zonder zoekterm worden de nieuwste vacatures getoond.",
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
    description: "Verwijder een vacature (soft-delete).",
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
    if (opts.query) {
      return searchJobsByTitle(opts.query, opts.limit);
    }
    return listJobs({ platform: opts.platform, limit: opts.limit, offset: opts.offset });
  },

  vacature_detail: async (raw) => {
    const { id } = vacatureDetailSchema.parse(raw);
    const result = await getJobById(id);
    if (!result) return { error: "Vacature niet gevonden" };
    return result;
  },

  update_vacature: async (raw) => {
    const { id, ...data } = updateVacatureSchema.parse(raw);
    const result = await updateJob(id, data);
    if (!result) return { error: "Vacature niet gevonden" };
    return result;
  },

  verwijder_vacature: async (raw) => {
    const { id } = verwijderVacatureSchema.parse(raw);
    const deleted = await deleteJob(id);
    if (!deleted) return { error: "Vacature niet gevonden of al verwijderd" };
    return { success: true, message: "Vacature verwijderd" };
  },

  auto_match_vacature: async (raw) => {
    const { jobId } = autoMatchVacatureSchema.parse(raw);
    return autoMatchJobToCandidates(jobId);
  },
};
