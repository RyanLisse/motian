import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { prepareChannelOfferHandoff } from "../../services/channel-offer-handoff";

const voorbereidenKanaalAanbodSchema = z.object({
  candidateId: z.string().uuid().describe("UUID van de kandidaat"),
  channelHint: z
    .string()
    .optional()
    .describe("Bedoeld kanaal of board (vrij tekst, bijv. Striive, LinkedIn)"),
  notes: z.string().optional().describe("Extra context voor de recruiter"),
});

export const tools = [
  {
    name: "voorbereiden_kanaal_aanbod",
    description:
      "Bereid een kandidaat-aanbod voor naar een extern kanaal (bron/board). Er is nog geen live API-koppeling; dit bevestigt gegevens en geeft een checklist voor handmatige upload (zelfde gedrag als AI-tool voorbereidenKanaalAanbod).",
    inputSchema: zodToJsonSchema(voorbereidenKanaalAanbodSchema, { $refStrategy: "none" }),
  },
];

export const handlers: Record<string, (args: unknown) => Promise<unknown>> = {
  voorbereiden_kanaal_aanbod: async (raw) => {
    const parsed = voorbereidenKanaalAanbodSchema.parse(raw);
    return prepareChannelOfferHandoff(parsed);
  },
};
