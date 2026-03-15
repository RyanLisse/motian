import { revalidatePath } from "next/cache";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { publish } from "../../lib/event-bus.js";
import {
  createMatch,
  deleteMatch,
  getMatchById,
  listMatches,
  updateMatchStatus,
} from "../../services/matches.js";

// ========== Schemas ==========

const zoekMatchesSchema = z.object({
  jobId: z.string().uuid().optional().describe("Filter op vacature-UUID"),
  candidateId: z.string().uuid().optional().describe("Filter op kandidaat-UUID"),
  status: z
    .string()
    .optional()
    .describe("Filter op status (bijv. 'pending', 'approved', 'rejected')"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Maximum aantal resultaten (standaard 50)"),
  offset: z.number().int().min(0).optional().describe("Offset voor paginering"),
});

const matchDetailSchema = z.object({
  id: z.string().uuid().describe("UUID van de match"),
});

const maakMatchSchema = z.object({
  jobId: z.string().uuid().describe("UUID van de vacature"),
  candidateId: z.string().uuid().describe("UUID van de kandidaat"),
  matchScore: z.number().min(0).max(100).describe("Matchscore (0-100)"),
  confidence: z.number().min(0).max(1).optional().describe("Betrouwbaarheidsscore (0-1)"),
  reasoning: z.string().optional().describe("Uitleg waarom deze match is gemaakt"),
  model: z.string().optional().describe("Model dat de match heeft gegenereerd"),
  recommendation: z.string().optional().describe("Aanbeveling (bijv. 'proceed', 'review', 'skip')"),
});

const keurMatchGoedSchema = z.object({
  id: z.string().uuid().describe("UUID van de match"),
  reviewedBy: z.string().optional().describe("Naam van de reviewer"),
});

const wijsMatchAfSchema = z.object({
  id: z.string().uuid().describe("UUID van de match"),
  reviewedBy: z.string().optional().describe("Naam van de reviewer"),
});

const verwijderMatchSchema = z.object({
  id: z.string().uuid().describe("UUID van de match"),
});

// ========== Tool Definitions ==========

export const tools = [
  {
    name: "zoek_matches",
    description:
      "Zoek matches tussen kandidaten en vacatures. Filter op vacature, kandidaat of status.",
    inputSchema: zodToJsonSchema(zoekMatchesSchema, { $refStrategy: "none" }),
  },
  {
    name: "match_detail",
    description: "Haal volledige details op van een match op basis van UUID.",
    inputSchema: zodToJsonSchema(matchDetailSchema, { $refStrategy: "none" }),
  },
  {
    name: "maak_match_aan",
    description: "Maak handmatig een nieuwe match aan tussen een kandidaat en vacature.",
    inputSchema: zodToJsonSchema(maakMatchSchema, { $refStrategy: "none" }),
  },
  {
    name: "keur_match_goed",
    description: "Keur een match goed (status wordt 'approved'). Optioneel met reviewer-naam.",
    inputSchema: zodToJsonSchema(keurMatchGoedSchema, { $refStrategy: "none" }),
  },
  {
    name: "wijs_match_af",
    description: "Wijs een match af (status wordt 'rejected'). Optioneel met reviewer-naam.",
    inputSchema: zodToJsonSchema(wijsMatchAfSchema, { $refStrategy: "none" }),
  },
  {
    name: "verwijder_match",
    description: "Verwijder een match permanent uit het systeem.",
    inputSchema: zodToJsonSchema(verwijderMatchSchema, { $refStrategy: "none" }),
  },
];

// ========== Handlers ==========

export const handlers: Record<string, (args: unknown) => Promise<unknown>> = {
  zoek_matches: async (raw) => {
    const opts = zoekMatchesSchema.parse(raw);
    return listMatches(opts);
  },

  match_detail: async (raw) => {
    const { id } = matchDetailSchema.parse(raw);
    const result = await getMatchById(id);
    if (!result) return { error: "Match niet gevonden" };
    return result;
  },

  maak_match_aan: async (raw) => {
    const data = maakMatchSchema.parse(raw);
    const match = await createMatch(data);
    revalidatePath("/kandidaten");
    revalidatePath("/vacatures");
    revalidatePath("/pipeline");
    revalidatePath("/overzicht");
    publish("match:created", { id: (match as { id: string }).id });
    return match;
  },

  keur_match_goed: async (raw) => {
    const { id, reviewedBy } = keurMatchGoedSchema.parse(raw);
    const result = await updateMatchStatus(id, "approved", reviewedBy);
    if (!result) return { error: "Match niet gevonden" };
    revalidatePath("/kandidaten");
    revalidatePath("/vacatures");
    revalidatePath("/pipeline");
    revalidatePath("/overzicht");
    publish("match:updated", { id, status: "approved" });
    return result;
  },

  wijs_match_af: async (raw) => {
    const { id, reviewedBy } = wijsMatchAfSchema.parse(raw);
    const result = await updateMatchStatus(id, "rejected", reviewedBy);
    if (!result) return { error: "Match niet gevonden" };
    revalidatePath("/kandidaten");
    revalidatePath("/vacatures");
    revalidatePath("/pipeline");
    revalidatePath("/overzicht");
    publish("match:updated", { id, status: "rejected" });
    return result;
  },

  verwijder_match: async (raw) => {
    const { id } = verwijderMatchSchema.parse(raw);
    const deleted = await deleteMatch(id);
    if (!deleted) return { error: "Match niet gevonden" };
    revalidatePath("/kandidaten");
    revalidatePath("/vacatures");
    revalidatePath("/pipeline");
    revalidatePath("/overzicht");
    publish("match:deleted", { id });
    return { success: true, message: "Match verwijderd" };
  },
};
