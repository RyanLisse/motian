import { tool } from "ai";
import { z } from "zod";
import {
  createApplication,
  deleteApplication,
  getApplicationById,
  getApplicationStats,
  listApplications,
  updateApplicationStage,
} from "@/src/services/applications";

const VALID_STAGES = ["new", "screening", "interview", "offer", "hired", "rejected"] as const;

export const zoekSollicitaties = tool({
  description:
    "Zoek en filter sollicitaties. Filter op vacature, kandidaat of fase. Gebruik dit om een overzicht te krijgen van sollicitaties in de pipeline.",
  inputSchema: z.object({
    jobId: z.string().uuid().optional().describe("UUID van de vacature om op te filteren"),
    candidateId: z.string().uuid().optional().describe("UUID van de kandidaat om op te filteren"),
    stage: z
      .enum(VALID_STAGES)
      .optional()
      .describe("Fase filter: new, screening, interview, offer, hired, rejected"),
    limit: z.number().optional().default(20).describe("Max resultaten (standaard 20)"),
  }),
  execute: async (params) => {
    const results = await listApplications({
      jobId: params.jobId,
      candidateId: params.candidateId,
      stage: params.stage,
      limit: params.limit,
    });
    return { total: results.length, sollicitaties: results };
  },
});

export const getSollicitatieDetail = tool({
  description:
    "Haal volledige details op van één sollicitatie op basis van ID. Gebruik dit wanneer de gebruiker meer wil weten over een specifieke sollicitatie.",
  inputSchema: z.object({
    id: z.string().uuid().describe("UUID van de sollicitatie"),
  }),
  execute: async ({ id }) => {
    const application = await getApplicationById(id);
    if (!application) return { error: "Sollicitatie niet gevonden" };
    return application;
  },
});

export const maakSollicitatieAan = tool({
  description:
    "Maak een nieuwe sollicitatie aan voor een kandidaat op een vacature. Koppelt een kandidaat aan een opdracht in de pipeline.",
  inputSchema: z.object({
    jobId: z.string().uuid().describe("UUID van de vacature"),
    candidateId: z.string().uuid().describe("UUID van de kandidaat"),
    matchId: z.string().uuid().optional().describe("UUID van de match (optioneel)"),
    source: z
      .string()
      .optional()
      .describe("Bron van de sollicitatie, bijv. 'ai-match', 'handmatig'"),
    notes: z.string().optional().describe("Notities bij de sollicitatie"),
  }),
  execute: async (params) => {
    const application = await createApplication({
      jobId: params.jobId,
      candidateId: params.candidateId,
      matchId: params.matchId,
      source: params.source,
      notes: params.notes,
    });
    return application;
  },
});

export const updateSollicitatieFase = tool({
  description:
    "Werk de fase van een sollicitatie bij. Verplaats een sollicitatie naar een nieuwe fase in de pipeline.",
  inputSchema: z.object({
    id: z.string().uuid().describe("UUID van de sollicitatie"),
    stage: z
      .enum(VALID_STAGES)
      .describe("Nieuwe fase: new, screening, interview, offer, hired, rejected"),
    notes: z.string().optional().describe("Notities bij de fase-wijziging"),
  }),
  execute: async ({ id, stage, notes }) => {
    const application = await updateApplicationStage(id, stage, notes);
    if (!application) return { error: "Sollicitatie niet gevonden" };
    return application;
  },
});

export const verwijderSollicitatie = tool({
  description:
    "Verwijder een sollicitatie (soft-delete). Gebruik dit om een sollicitatie uit de pipeline te verwijderen.",
  inputSchema: z.object({
    id: z.string().uuid().describe("UUID van de sollicitatie"),
  }),
  execute: async ({ id }) => {
    const success = await deleteApplication(id);
    if (!success) return { error: "Sollicitatie niet gevonden of kon niet verwijderd worden" };
    return { success: true, message: "Sollicitatie succesvol verwijderd" };
  },
});

export const getSollicitatieStats = tool({
  description:
    "Haal statistieken op van de sollicitatie-pipeline. Toont totaal aantal en verdeling per fase.",
  inputSchema: z.object({}),
  execute: async () => {
    const stats = await getApplicationStats();
    return stats;
  },
});
