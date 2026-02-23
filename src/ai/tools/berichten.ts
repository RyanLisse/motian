import { tool } from "ai";
import { z } from "zod";
import {
  createMessage,
  deleteMessage,
  getMessageById,
  listMessages,
} from "@/src/services/messages";

export const zoekBerichten = tool({
  description:
    "Zoek en filter berichten. Filter op sollicitatie, richting (inbound/outbound) en kanaal (email/phone/platform). Gebruik dit om berichten te bekijken of te doorzoeken.",
  inputSchema: z.object({
    applicationId: z
      .string()
      .uuid()
      .optional()
      .describe("UUID van de sollicitatie om berichten voor op te halen"),
    direction: z
      .enum(["inbound", "outbound"])
      .optional()
      .describe("Richting: inbound (ontvangen) of outbound (verzonden)"),
    channel: z
      .enum(["email", "phone", "platform"])
      .optional()
      .describe("Kanaal: email, phone of platform"),
    limit: z.number().optional().default(20).describe("Max aantal resultaten (standaard 20)"),
  }),
  execute: async (params) => {
    const messages = await listMessages({
      applicationId: params.applicationId,
      direction: params.direction,
      channel: params.channel,
      limit: params.limit,
    });
    return {
      total: messages.length,
      berichten: messages,
    };
  },
});

export const getBerichtDetail = tool({
  description:
    "Haal volledige details op van een enkel bericht op basis van ID. Gebruik dit wanneer de gebruiker meer wil weten over een specifiek bericht.",
  inputSchema: z.object({
    id: z.string().uuid().describe("UUID van het bericht"),
  }),
  execute: async ({ id }) => {
    const message = await getMessageById(id);
    if (!message) return { error: "Bericht niet gevonden" };
    return message;
  },
});

export const stuurBericht = tool({
  description:
    "Maak en verstuur een nieuw bericht gekoppeld aan een sollicitatie. Geef het kanaal, de richting en de inhoud op.",
  inputSchema: z.object({
    applicationId: z
      .string()
      .uuid()
      .describe("UUID van de sollicitatie waar het bericht bij hoort"),
    direction: z
      .enum(["inbound", "outbound"])
      .describe("Richting: inbound (ontvangen) of outbound (verzonden)"),
    channel: z.enum(["email", "phone", "platform"]).describe("Kanaal: email, phone of platform"),
    subject: z.string().optional().describe("Onderwerp van het bericht (optioneel)"),
    body: z.string().describe("Inhoud van het bericht"),
  }),
  execute: async (params) => {
    const message = await createMessage({
      applicationId: params.applicationId,
      direction: params.direction,
      channel: params.channel,
      subject: params.subject,
      body: params.body,
    });
    if (!message) return { error: "Bericht kon niet worden aangemaakt" };
    return message;
  },
});

export const verwijderBericht = tool({
  description:
    "Verwijder een bericht op basis van ID. Gebruik dit wanneer een bericht moet worden verwijderd.",
  inputSchema: z.object({
    id: z.string().uuid().describe("UUID van het bericht dat verwijderd moet worden"),
  }),
  execute: async ({ id }) => {
    const success = await deleteMessage(id);
    if (!success) return { error: "Bericht niet gevonden of kon niet worden verwijderd" };
    return { success: true, message: "Bericht succesvol verwijderd" };
  },
});
