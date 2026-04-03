import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  getApplicationById,
  getApplicationStats,
  listApplications,
} from "../../services/applications";
import { getInterviewById, listInterviews } from "../../services/interviews";
import { getMessageById, listMessages } from "../../services/messages";
import {
  createApplicationWithEffects,
  createInterviewWithEffects,
  createMessageWithEffects,
  deleteApplicationWithEffects,
  deleteInterviewWithEffects,
  deleteMessageWithEffects,
  updateApplicationStageWithEffects,
  updateInterviewWithEffects,
  updateMessageWithEffects,
} from "../../services/pipeline-effects";

// ========== Schemas ==========

const zoekSollicitatiesSchema = z.object({
  jobId: z.string().uuid().optional().describe("Filter op vacature-UUID"),
  candidateId: z.string().uuid().optional().describe("Filter op kandidaat-UUID"),
  stage: z
    .string()
    .optional()
    .describe("Filter op fase (new, screening, interview, offer, hired, rejected)"),
  limit: z.number().int().min(1).max(100).optional().describe("Maximum aantal resultaten"),
  offset: z.number().int().min(0).optional().describe("Offset voor paginering"),
});

const sollicitatieDetailSchema = z.object({
  id: z.string().uuid().describe("UUID van de sollicitatie"),
});

const maakSollicitatieSchema = z.object({
  jobId: z.string().uuid().describe("UUID van de vacature"),
  candidateId: z.string().uuid().describe("UUID van de kandidaat"),
  matchId: z.string().uuid().optional().describe("UUID van een bestaande match (optioneel)"),
  source: z.string().optional().describe("Bron van de sollicitatie (bijv. 'manual', 'auto-match')"),
  notes: z.string().optional().describe("Notities bij de sollicitatie"),
});

const updateSollicitatieFaseSchema = z.object({
  id: z.string().uuid().describe("UUID van de sollicitatie"),
  stage: z
    .enum(["new", "screening", "interview", "offer", "hired", "rejected"])
    .describe("Nieuwe fase"),
  notes: z.string().optional().describe("Toelichting bij de fase-wijziging"),
});

const zoekInterviewsSchema = z.object({
  applicationId: z.string().uuid().optional().describe("Filter op sollicitatie-UUID"),
  status: z.string().optional().describe("Filter op status (scheduled, completed, cancelled)"),
  limit: z.number().int().min(1).max(100).optional().describe("Maximum aantal resultaten"),
  offset: z.number().int().min(0).optional().describe("Offset voor paginering"),
});

const planInterviewSchema = z.object({
  applicationId: z.string().uuid().describe("UUID van de sollicitatie"),
  scheduledAt: z.string().describe("Datum en tijd van het interview (ISO 8601 formaat)"),
  type: z.enum(["phone", "video", "onsite", "technical"]).describe("Type interview"),
  interviewer: z.string().min(1).describe("Naam van de interviewer"),
  duration: z.number().int().min(15).max(480).optional().describe("Duur in minuten (standaard 60)"),
  location: z.string().optional().describe("Locatie of videolink"),
});

const updateInterviewSchema = z.object({
  id: z.string().uuid().describe("UUID van het interview"),
  status: z.enum(["scheduled", "completed", "cancelled"]).optional().describe("Nieuwe status"),
  feedback: z.string().optional().describe("Feedback van de interviewer"),
  rating: z.number().int().min(1).max(5).optional().describe("Beoordeling (1-5)"),
});

const zoekBerichtenSchema = z.object({
  applicationId: z.string().uuid().optional().describe("Filter op sollicitatie-UUID"),
  direction: z.enum(["inbound", "outbound"]).optional().describe("Filter op richting"),
  channel: z.enum(["email", "phone", "platform"]).optional().describe("Filter op kanaal"),
  limit: z.number().int().min(1).max(100).optional().describe("Maximum aantal resultaten"),
  offset: z.number().int().min(0).optional().describe("Offset voor paginering"),
});

const verwijderSollicitatieSchema = z.object({
  id: z.string().uuid().describe("UUID van de sollicitatie"),
});

const interviewDetailSchema = z.object({
  id: z.string().uuid().describe("UUID van het interview"),
});

const verwijderInterviewSchema = z.object({
  id: z.string().uuid().describe("UUID van het interview"),
});

const berichtDetailSchema = z.object({
  id: z.string().uuid().describe("UUID van het bericht"),
});

const verwijderBerichtSchema = z.object({
  id: z.string().uuid().describe("UUID van het bericht"),
});

const updateBerichtSchema = z.object({
  id: z.string().uuid().describe("UUID van het bericht"),
  subject: z.string().optional().describe("Nieuw onderwerp (voor e-mail)"),
  body: z.string().min(1).optional().describe("Nieuwe inhoud van het bericht"),
});

const stuurBerichtSchema = z.object({
  applicationId: z.string().uuid().describe("UUID van de sollicitatie"),
  direction: z.enum(["inbound", "outbound"]).describe("Richting van het bericht"),
  channel: z.enum(["email", "phone", "platform"]).describe("Communicatiekanaal"),
  subject: z.string().optional().describe("Onderwerp (voor e-mail)"),
  body: z.string().min(1).describe("Inhoud van het bericht"),
});

// ========== Tool Definitions ==========

export const tools = [
  {
    name: "zoek_sollicitaties",
    description: "Zoek sollicitaties, optioneel gefilterd op vacature, kandidaat of fase.",
    inputSchema: zodToJsonSchema(zoekSollicitatiesSchema, { $refStrategy: "none" }),
  },
  {
    name: "sollicitatie_detail",
    description: "Haal volledige details op van een sollicitatie op basis van UUID.",
    inputSchema: zodToJsonSchema(sollicitatieDetailSchema, { $refStrategy: "none" }),
  },
  {
    name: "maak_sollicitatie_aan",
    description: "Maak een nieuwe sollicitatie aan voor een kandidaat bij een vacature.",
    inputSchema: zodToJsonSchema(maakSollicitatieSchema, { $refStrategy: "none" }),
  },
  {
    name: "update_sollicitatie_fase",
    description: "Werk de fase van een sollicitatie bij (bijv. van 'screening' naar 'interview').",
    inputSchema: zodToJsonSchema(updateSollicitatieFaseSchema, { $refStrategy: "none" }),
  },
  {
    name: "sollicitatie_stats",
    description: "Bekijk statistieken van alle sollicitaties, opgesplitst per fase.",
    inputSchema: zodToJsonSchema(z.object({}), { $refStrategy: "none" }),
  },
  {
    name: "zoek_interviews",
    description: "Zoek interviews, optioneel gefilterd op sollicitatie of status.",
    inputSchema: zodToJsonSchema(zoekInterviewsSchema, { $refStrategy: "none" }),
  },
  {
    name: "plan_interview",
    description: "Plan een nieuw interview in voor een sollicitatie.",
    inputSchema: zodToJsonSchema(planInterviewSchema, { $refStrategy: "none" }),
  },
  {
    name: "update_interview",
    description: "Werk een interview bij met status, feedback of beoordeling.",
    inputSchema: zodToJsonSchema(updateInterviewSchema, { $refStrategy: "none" }),
  },
  {
    name: "zoek_berichten",
    description: "Zoek berichten/communicatie bij sollicitaties. Filter op richting of kanaal.",
    inputSchema: zodToJsonSchema(zoekBerichtenSchema, { $refStrategy: "none" }),
  },
  {
    name: "stuur_bericht",
    description: "Registreer een bericht (e-mail, telefoon of platform) bij een sollicitatie.",
    inputSchema: zodToJsonSchema(stuurBerichtSchema, { $refStrategy: "none" }),
  },
  {
    name: "verwijder_sollicitatie",
    description: "Verwijder een sollicitatie (soft-delete).",
    inputSchema: zodToJsonSchema(verwijderSollicitatieSchema, { $refStrategy: "none" }),
  },
  {
    name: "interview_detail",
    description: "Haal volledige details op van een interview op basis van UUID.",
    inputSchema: zodToJsonSchema(interviewDetailSchema, { $refStrategy: "none" }),
  },
  {
    name: "verwijder_interview",
    description: "Verwijder een interview permanent.",
    inputSchema: zodToJsonSchema(verwijderInterviewSchema, { $refStrategy: "none" }),
  },
  {
    name: "bericht_detail",
    description: "Haal volledige details op van een bericht op basis van UUID.",
    inputSchema: zodToJsonSchema(berichtDetailSchema, { $refStrategy: "none" }),
  },
  {
    name: "verwijder_bericht",
    description: "Verwijder een bericht permanent.",
    inputSchema: zodToJsonSchema(verwijderBerichtSchema, { $refStrategy: "none" }),
  },
  {
    name: "update_bericht",
    description: "Werk de inhoud (body) of het onderwerp (subject) van een bericht bij.",
    inputSchema: zodToJsonSchema(updateBerichtSchema, { $refStrategy: "none" }),
  },
];

// ========== Handlers ==========

export const handlers: Record<string, (args: unknown) => Promise<unknown>> = {
  zoek_sollicitaties: async (raw) => {
    const opts = zoekSollicitatiesSchema.parse(raw);
    return listApplications(opts);
  },

  sollicitatie_detail: async (raw) => {
    const { id } = sollicitatieDetailSchema.parse(raw);
    const result = await getApplicationById(id);
    if (!result) return { error: "Sollicitatie niet gevonden" };
    return result;
  },

  maak_sollicitatie_aan: async (raw) => {
    const data = maakSollicitatieSchema.parse(raw);
    return createApplicationWithEffects(data);
  },

  update_sollicitatie_fase: async (raw) => {
    const { id, stage, notes } = updateSollicitatieFaseSchema.parse(raw);
    const result = await updateApplicationStageWithEffects(id, stage, notes);
    if (!result) return { error: "Sollicitatie niet gevonden of ongeldige fase" };
    return result;
  },

  sollicitatie_stats: async () => {
    return getApplicationStats();
  },

  zoek_interviews: async (raw) => {
    const opts = zoekInterviewsSchema.parse(raw);
    return listInterviews(opts);
  },

  plan_interview: async (raw) => {
    const data = planInterviewSchema.parse(raw);
    return createInterviewWithEffects({ ...data, scheduledAt: new Date(data.scheduledAt) });
  },

  update_interview: async (raw) => {
    const { id, ...data } = updateInterviewSchema.parse(raw);
    const result = await updateInterviewWithEffects(id, data);
    if ("error" in result) return { error: result.error };
    return result.interview;
  },

  zoek_berichten: async (raw) => {
    const opts = zoekBerichtenSchema.parse(raw);
    return listMessages(opts);
  },

  stuur_bericht: async (raw) => {
    const data = stuurBerichtSchema.parse(raw);
    const result = await createMessageWithEffects(data);
    if (!result) return { error: "Ongeldig kanaal of richting" };
    return result;
  },

  verwijder_sollicitatie: async (raw) => {
    const { id } = verwijderSollicitatieSchema.parse(raw);
    const deleted = await deleteApplicationWithEffects(id);
    if (!deleted) return { error: "Sollicitatie niet gevonden of al verwijderd" };
    return { success: true, message: "Sollicitatie verwijderd" };
  },

  interview_detail: async (raw) => {
    const { id } = interviewDetailSchema.parse(raw);
    const result = await getInterviewById(id);
    if (!result) return { error: "Interview niet gevonden" };
    return result;
  },

  verwijder_interview: async (raw) => {
    const { id } = verwijderInterviewSchema.parse(raw);
    const deleted = await deleteInterviewWithEffects(id);
    if (!deleted) return { error: "Interview niet gevonden" };
    return { success: true, message: "Interview verwijderd" };
  },

  bericht_detail: async (raw) => {
    const { id } = berichtDetailSchema.parse(raw);
    const result = await getMessageById(id);
    if (!result) return { error: "Bericht niet gevonden" };
    return result;
  },

  verwijder_bericht: async (raw) => {
    const { id } = verwijderBerichtSchema.parse(raw);
    const deleted = await deleteMessageWithEffects(id);
    if (!deleted) return { error: "Bericht niet gevonden" };
    return { success: true, message: "Bericht verwijderd" };
  },

  update_bericht: async (raw) => {
    const { id, ...data } = updateBerichtSchema.parse(raw);
    if (!data.subject && !data.body) return { error: "Geen velden opgegeven om bij te werken" };
    const result = await updateMessageWithEffects(id, data);
    if (!result) return { error: "Bericht niet gevonden" };
    return result;
  },
};
