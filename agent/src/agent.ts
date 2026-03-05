import { llm, voice } from "@livekit/agents";
import { z } from "zod";

/**
 * Motian recruitment voice agent.
 *
 * Exposed tools allow the agent to search jobs, find candidates,
 * and create matches — all via voice commands.
 */
export class MotianAgent extends voice.Agent {
  constructor() {
    super({
      instructions: `Je bent Motian AI, de slimme recruitment assistent.
Antwoord in het Nederlands tenzij de gebruiker Engels spreekt.
Je helpt met vacatures zoeken, kandidaten beheren, en matches maken.
Houd antwoorden kort en duidelijk — je praat via spraak.
Gebruik een professionele maar vriendelijke toon.
Als je iets niet weet, zeg dat eerlijk.`,

      tools: {
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
            // Call the Motian API from the agent backend
            const params = new URLSearchParams({ q: query });
            if (locatie) params.set("locatie", locatie);

            const baseUrl =
              process.env.MOTIAN_API_URL ?? "http://localhost:3001";
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
            const baseUrl =
              process.env.MOTIAN_API_URL ?? "http://localhost:3001";
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
            const baseUrl =
              process.env.MOTIAN_API_URL ?? "http://localhost:3001";
            const res = await fetch(
              `${baseUrl}/api/matches/auto?kandidaatId=${kandidaatId}`,
            );
            if (!res.ok) return { error: "Matching mislukt" };
            return res.json();
          },
        }),
      },
    });
  }
}
