import { tool } from "ai";
import { z } from "zod";
import {
  approveMatchWithEffects,
  createMatchWithEffects,
  deleteMatchWithEffects,
  rejectMatchWithEffects,
} from "@/src/services/match-effects";
import { getMatchById, listMatches } from "@/src/services/matches";

export const zoekMatches = tool({
  description:
    "Zoek en filter matches tussen opdrachten en kandidaten. Gebruik dit om matches te vinden op basis van opdracht, kandidaat of status.",
  inputSchema: z.object({
    jobId: z.string().uuid().optional().describe("UUID van de opdracht om op te filteren"),
    candidateId: z.string().uuid().optional().describe("UUID van de kandidaat om op te filteren"),
    status: z.string().optional().describe("Status filter: pending, approved, rejected"),
    limit: z.number().optional().default(20).describe("Max resultaten (standaard 20)"),
  }),
  execute: async (params) => {
    const matches = await listMatches({
      jobId: params.jobId,
      candidateId: params.candidateId,
      status: params.status,
      limit: params.limit,
    });
    return { total: matches.length, matches };
  },
});

export const getMatchDetail = tool({
  description:
    "Haal volledige details op van één match op basis van ID. Gebruik dit wanneer de gebruiker meer wil weten over een specifieke match.",
  inputSchema: z.object({
    id: z.string().uuid().describe("UUID van de match"),
  }),
  execute: async ({ id }) => {
    const match = await getMatchById(id);
    if (!match) return { error: "Match niet gevonden" };
    return match;
  },
});

export const keurMatchGoed = tool({
  description:
    "Keur een match goed. Zet de status op 'approved'. Gebruik dit wanneer een match wordt goedgekeurd.",
  inputSchema: z.object({
    id: z.string().uuid().describe("UUID van de match om goed te keuren"),
    reviewedBy: z.string().optional().describe("Naam of ID van de beoordelaar"),
  }),
  execute: async ({ id, reviewedBy }) => {
    const match = await approveMatchWithEffects(id, reviewedBy);
    if (!match) return { error: "Match niet gevonden" };
    return match;
  },
});

export const wijsMatchAf = tool({
  description:
    "Wijs een match af. Zet de status op 'rejected'. Gebruik dit wanneer een match wordt afgewezen.",
  inputSchema: z.object({
    id: z.string().uuid().describe("UUID van de match om af te wijzen"),
    reviewedBy: z.string().optional().describe("Naam of ID van de beoordelaar"),
  }),
  execute: async ({ id, reviewedBy }) => {
    const match = await rejectMatchWithEffects(id, reviewedBy);
    if (!match) return { error: "Match niet gevonden" };
    return match;
  },
});

export const maakMatchAan = tool({
  description:
    "Maak een nieuwe match aan tussen een vacature en een kandidaat. Geef een score en optioneel een aanbeveling.",
  inputSchema: z.object({
    jobId: z.string().uuid().describe("UUID van de vacature"),
    candidateId: z.string().uuid().describe("UUID van de kandidaat"),
    matchScore: z.number().min(0).max(100).describe("Matchscore (0-100)"),
    reasoning: z.string().optional().describe("Reden of toelichting voor de match"),
    recommendation: z
      .enum(["go", "no-go", "conditional"])
      .optional()
      .describe("Aanbeveling: go, no-go, of conditional"),
  }),
  execute: async ({ jobId, candidateId, matchScore, reasoning, recommendation }) => {
    try {
      const match = await createMatchWithEffects({
        jobId,
        candidateId,
        matchScore,
        reasoning,
        recommendation,
        model: "manual-agent",
      });
      return match;
    } catch (err) {
      const msg = String(err);
      if (msg.includes("unique") || msg.includes("duplicate")) {
        return { error: "Er bestaat al een match voor deze vacature en kandidaat" };
      }
      return { error: "Match kon niet worden aangemaakt" };
    }
  },
});

export const verwijderMatch = tool({
  description:
    "Verwijder een match permanent op basis van ID. Let op: dit is een harde verwijdering die niet ongedaan kan worden gemaakt. Gebruik dit om een onjuiste of ongewenste match te verwijderen.",
  inputSchema: z.object({
    id: z.string().uuid().describe("UUID van de match om te verwijderen"),
  }),
  execute: async ({ id }) => {
    const existing = await getMatchById(id);
    if (!existing) return { error: "Match niet gevonden of kon niet worden verwijderd" };
    const deleted = await deleteMatchWithEffects(id, existing);
    if (!deleted) return { error: "Match niet gevonden of kon niet worden verwijderd" };
    return { success: true, message: "Match succesvol verwijderd" };
  },
});
