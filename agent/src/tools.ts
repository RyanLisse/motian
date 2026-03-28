import { llm } from "@livekit/agents";
import { z } from "zod";

/** Resolve the Motian web app base URL from env or default to localhost. */
function getBaseUrl(): string {
  return process.env.MOTIAN_API_URL ?? "http://localhost:3001";
}

/**
 * Create the set of LLM tools exposed by the Motian voice agent.
 *
 * Each tool calls back into the Next.js API so the agent can search
 * vacatures, find kandidaten, and create matches via voice commands.
 */
export function createMotianTools() {
  const baseUrl = getBaseUrl();

  return {
    zoekVacatures: llm.tool({
      description:
        "Zoek beschikbare vacatures op basis van trefwoorden, locatie of categorie",
      parameters: z.object({
        query: z.string().describe("Zoekterm voor vacatures"),
        locatie: z
          .string()
          .optional()
          .describe("Provincie of stad filter"),
      }),
      execute: async ({ query, locatie }) => {
        const params = new URLSearchParams({ q: query });
        if (locatie) params.set("locatie", locatie);

        const res = await fetch(
          `${baseUrl}/api/vacatures/zoek?${params.toString()}`,
        );
        if (!res.ok) return { error: "Vacatures ophalen mislukt" };
        return res.json();
      },
    }),

    zoekKandidaten: llm.tool({
      description:
        "Zoek kandidaten op basis van vaardigheden, rol of locatie",
      parameters: z.object({
        query: z.string().describe("Zoekterm voor kandidaten"),
      }),
      execute: async ({ query }) => {
        const res = await fetch(
          `${baseUrl}/api/kandidaten/zoek?q=${encodeURIComponent(query)}`,
        );
        if (!res.ok) return { error: "Kandidaten ophalen mislukt" };
        return res.json();
      },
    }),

    matchKandidaat: llm.tool({
      description:
        "Zoek passende vacatures voor een kandidaat op basis van hun profiel",
      parameters: z.object({
        kandidaatId: z.string().describe("UUID van de kandidaat"),
      }),
      execute: async ({ kandidaatId }) => {
        const res = await fetch(
          `${baseUrl}/api/matches/auto?kandidaatId=${kandidaatId}`,
        );
        if (!res.ok) return { error: "Matching mislukt" };
        return res.json();
      },
    }),
  };
}
