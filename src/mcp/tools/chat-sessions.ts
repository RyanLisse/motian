import { revalidatePath } from "next/cache";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { publish } from "../../lib/event-bus";
import { deleteSession, getSession, listSessions } from "../../services/chat-sessions";

// ========== Schemas ==========

const zoekChatSessiesSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Maximum aantal sessies (standaard 20)"),
  cursor: z.string().optional().describe("Cursor voor paginering (uit vorige response)"),
});

const chatSessieDetailSchema = z.object({
  sessionId: z.string().min(1).describe("Session-ID van de chat sessie"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Maximum aantal berichten per pagina"),
  cursor: z.string().optional().describe("Cursor voor berichtpaginering"),
});

const verwijderChatSessieSchema = z.object({
  sessionId: z.string().min(1).describe("Session-ID van de te verwijderen chat sessie"),
});

// ========== Tool Definitions ==========

export const tools = [
  {
    name: "zoek_chat_sessies",
    description:
      "Lijst van chat sessies ophalen, gesorteerd op laatste activiteit. Ondersteunt paginering.",
    inputSchema: zodToJsonSchema(zoekChatSessiesSchema, { $refStrategy: "none" }),
  },
  {
    name: "chat_sessie_detail",
    description:
      "Haal details en berichten op van een specifieke chat sessie op basis van session-ID.",
    inputSchema: zodToJsonSchema(chatSessieDetailSchema, { $refStrategy: "none" }),
  },
  {
    name: "verwijder_chat_sessie",
    description: "Verwijder een chat sessie en alle bijbehorende berichten.",
    inputSchema: zodToJsonSchema(verwijderChatSessieSchema, { $refStrategy: "none" }),
  },
];

// ========== Handlers ==========

export const handlers: Record<string, (args: unknown) => Promise<unknown>> = {
  zoek_chat_sessies: async (raw) => {
    const { limit, cursor } = zoekChatSessiesSchema.parse(raw);
    return listSessions({ limit, cursor });
  },

  chat_sessie_detail: async (raw) => {
    const { sessionId, limit, cursor } = chatSessieDetailSchema.parse(raw);
    const result = await getSession(sessionId, { limit, cursor });
    if (!result) return { error: "Chat sessie niet gevonden" };
    return result;
  },

  verwijder_chat_sessie: async (raw) => {
    const { sessionId } = verwijderChatSessieSchema.parse(raw);
    const deleted = await deleteSession(sessionId);
    if (!deleted) return { error: "Chat sessie niet gevonden of al verwijderd" };
    revalidatePath("/chat");
    publish("chat_session:deleted", { id: sessionId });
    return { success: true, message: "Chat sessie verwijderd" };
  },
};
