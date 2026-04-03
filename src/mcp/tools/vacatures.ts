import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { withJobCanonicalSkills, withJobsCanonicalSkills } from "../../services/esco";
import {
  autoMatchJobWithEffects,
  createJobWithEffects,
  deleteJobWithEffects,
  updateJobWithEffects,
} from "../../services/job-effects";
import type { ListJobsSortBy } from "../../services/jobs";
import { getJobById, searchJobsUnified } from "../../services/jobs";

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
  compact: z
    .boolean()
    .optional()
    .describe("Compacte weergave: geen beschrijving (bespaart tokens)"),
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

const maakVacatureAanSchema = z.object({
  title: z.string().describe("Functietitel van de vacature"),
  platform: z.string().default("handmatig").describe("Platform herkomst (standaard 'handmatig')"),
  externalId: z.string().optional().describe("Extern ID (wordt automatisch gegenereerd als leeg)"),
  company: z.string().optional().describe("Opdrachtgever / bedrijf"),
  endClient: z.string().optional().describe("Eindklant"),
  description: z.string().optional().describe("Omschrijving van de vacature"),
  location: z.string().optional().describe("Locatie (stad of regio)"),
  province: z.string().optional().describe("Provincie"),
  rateMin: z.number().optional().describe("Minimaal uurtarief in EUR"),
  rateMax: z.number().optional().describe("Maximaal uurtarief in EUR"),
  contractType: z.string().optional().describe("Contract type: freelance, interim, vast"),
  workArrangement: z.string().optional().describe("Werkvorm: hybride, op_locatie, remote"),
  hoursPerWeek: z.number().optional().describe("Uren per week"),
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
    name: "maak_vacature_aan",
    description:
      "Maak een nieuwe vacature handmatig aan. Gebruik voor vacatures die niet via een scraper binnenkomen.",
    inputSchema: zodToJsonSchema(maakVacatureAanSchema, { $refStrategy: "none" }),
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
    if (opts.compact) {
      return { total: result.total, vacatures: vacatures.map(({ description, ...v }) => v) };
    }
    return { total: result.total, vacatures };
  },

  maak_vacature_aan: async (raw) => {
    const data = maakVacatureAanSchema.parse(raw);
    const result = await createJobWithEffects(data);
    return withJobCanonicalSkills(result);
  },

  vacature_detail: async (raw) => {
    const { id } = vacatureDetailSchema.parse(raw);
    const result = await getJobById(id);
    if (!result) return { error: "Vacature niet gevonden" };
    return withJobCanonicalSkills(result);
  },

  update_vacature: async (raw) => {
    const { id, ...data } = updateVacatureSchema.parse(raw);
    const result = await updateJobWithEffects(id, data);
    if (!result) return { error: "Vacature niet gevonden" };
    return withJobCanonicalSkills(result);
  },

  verwijder_vacature: async (raw) => {
    const { id } = verwijderVacatureSchema.parse(raw);
    const deleted = await deleteJobWithEffects(id);
    if (!deleted) return { error: "Vacature niet gevonden of al gearchiveerd" };
    return { success: true, message: "Vacature gearchiveerd" };
  },

  auto_match_vacature: async (raw) => {
    const { jobId } = autoMatchVacatureSchema.parse(raw);
    return autoMatchJobWithEffects(jobId);
  },
};
