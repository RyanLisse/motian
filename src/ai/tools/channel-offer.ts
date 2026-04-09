import { tool } from "ai";
import { z } from "zod";
import { prepareChannelOfferHandoff } from "@/src/services/channel-offer-handoff";

/**
 * Issue #148 placeholder: external channel submission is not wired to a provider yet.
 * Returns a structured handoff payload the agent can share with the recruiter.
 */
export const voorbereidenKanaalAanbod = tool({
  description:
    "Bereid een kandidaat-aanbod voor naar een extern kanaal (bron/board). Er is nog geen live API-koppeling; dit bevestigt gegevens en geeft een checklist voor handmatige upload.",
  inputSchema: z.object({
    candidateId: z.string().describe("Kandidaat-ID"),
    channelHint: z
      .string()
      .optional()
      .describe("Bedoeld kanaal of board (vrij tekst, bijv. Striive, LinkedIn)"),
    notes: z.string().optional().describe("Extra context voor de recruiter"),
  }),
  execute: async ({ candidateId, channelHint, notes }) =>
    prepareChannelOfferHandoff({ candidateId, channelHint, notes }),
});
