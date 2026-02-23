import { tool } from "ai";
import { z } from "zod";
import { getMatchById, listMatches, updateMatchStatus } from "@/src/services/matches";

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
    const match = await updateMatchStatus(id, "approved", reviewedBy);
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
    const match = await updateMatchStatus(id, "rejected", reviewedBy);
    if (!match) return { error: "Match niet gevonden" };
    return match;
  },
});
