import { revalidatePath } from "next/cache";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { publish } from "../../lib/event-bus";
import {
  createScreeningCall,
  getScreeningCall,
  listScreeningCalls,
  updateScreeningCall,
} from "../../services/screening-calls";

// ========== Schemas ==========

const zoekScreeningCallsSchema = z.object({
  candidateId: z.string().uuid().describe("UUID van de kandidaat"),
});

const screeningCallDetailSchema = z.object({
  id: z.string().uuid().describe("UUID van de screening call"),
});

const maakScreeningCallAanSchema = z.object({
  candidateId: z.string().uuid().describe("UUID van de kandidaat"),
  jobId: z.string().uuid().optional().describe("UUID van de vacature (optioneel)"),
  matchId: z.string().uuid().optional().describe("UUID van de match (optioneel)"),
  applicationId: z.string().uuid().optional().describe("UUID van de sollicitatie (optioneel)"),
  initiatedBy: z
    .enum(["recruiter", "ai_agent"])
    .optional()
    .describe("Wie initieert het gesprek (standaard 'recruiter')"),
});

const updateScreeningCallSchema = z.object({
  id: z.string().uuid().describe("UUID van de screening call"),
  status: z
    .string()
    .optional()
    .describe("Nieuwe status (pending, in_progress, completed, cancelled)"),
  callSummary: z.string().optional().describe("Samenvatting van het gesprek"),
  callNotes: z.string().optional().describe("Notities bij het gesprek"),
  callDurationSeconds: z.number().int().min(0).optional().describe("Gespreksduur in seconden"),
  candidateSentiment: z
    .string()
    .optional()
    .describe("Sentiment van de kandidaat (positive, neutral, negative)"),
  recommendedNextStep: z.string().optional().describe("Aanbevolen vervolgstap"),
  startedAt: z.string().optional().describe("Starttijd van het gesprek (ISO 8601)"),
  endedAt: z.string().optional().describe("Eindtijd van het gesprek (ISO 8601)"),
});

// ========== Tool Definitions ==========

export const tools = [
  {
    name: "zoek_screening_calls",
    description:
      "Lijst van screening calls ophalen voor een kandidaat, gesorteerd op aanmaakdatum.",
    inputSchema: zodToJsonSchema(zoekScreeningCallsSchema, { $refStrategy: "none" }),
  },
  {
    name: "screening_call_detail",
    description: "Haal volledige details op van een screening call op basis van UUID.",
    inputSchema: zodToJsonSchema(screeningCallDetailSchema, { $refStrategy: "none" }),
  },
  {
    name: "maak_screening_call_aan",
    description:
      "Start een nieuwe screening call voor een kandidaat. Genereert automatisch screeningvragen op basis van kandidaat-, vacature- en matchgegevens.",
    inputSchema: zodToJsonSchema(maakScreeningCallAanSchema, { $refStrategy: "none" }),
  },
  {
    name: "update_screening_call",
    description:
      "Werk een screening call bij met status, samenvatting, notities of andere gegevens.",
    inputSchema: zodToJsonSchema(updateScreeningCallSchema, { $refStrategy: "none" }),
  },
];

// ========== Handlers ==========

export const handlers: Record<string, (args: unknown) => Promise<unknown>> = {
  zoek_screening_calls: async (raw) => {
    const { candidateId } = zoekScreeningCallsSchema.parse(raw);
    return listScreeningCalls(candidateId);
  },

  screening_call_detail: async (raw) => {
    const { id } = screeningCallDetailSchema.parse(raw);
    const result = await getScreeningCall(id);
    if (!result) return { error: "Screening call niet gevonden" };
    return result;
  },

  maak_screening_call_aan: async (raw) => {
    const data = maakScreeningCallAanSchema.parse(raw);
    const call = await createScreeningCall(data);
    revalidatePath("/screening");
    publish("screening-call:created", { id: (call as { id: string }).id });
    return call;
  },

  update_screening_call: async (raw) => {
    const { id, startedAt, endedAt, ...rest } = updateScreeningCallSchema.parse(raw);
    const data = {
      ...rest,
      ...(startedAt ? { startedAt: new Date(startedAt) } : {}),
      ...(endedAt ? { endedAt: new Date(endedAt) } : {}),
    };
    const updated = await updateScreeningCall(id, data);
    if (!updated) return { error: "Screening call niet gevonden" };
    revalidatePath("/screening");
    publish("screening-call:updated", { id });
    return updated;
  },
};
