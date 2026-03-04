import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { chatSessions } from "../db/schema";

// ========== Types ==========

export type ChatSessionSummary = {
  id: string;
  sessionId: string;
  title: string | null;
  lastMessagePreview: string | null;
  messageCount: number | null;
  context: unknown;
  updatedAt: Date | null;
  createdAt: Date | null;
};

export type ChatSessionFull = typeof chatSessions.$inferSelect;

// ========== Service Functions ==========

/** Recente chat sessies ophalen, gesorteerd op laatst bijgewerkt. */
export async function listSessions(limit = 20): Promise<ChatSessionSummary[]> {
  return db
    .select({
      id: chatSessions.id,
      sessionId: chatSessions.sessionId,
      title: chatSessions.title,
      lastMessagePreview: chatSessions.lastMessagePreview,
      messageCount: chatSessions.messageCount,
      context: chatSessions.context,
      updatedAt: chatSessions.updatedAt,
      createdAt: chatSessions.createdAt,
    })
    .from(chatSessions)
    .orderBy(desc(chatSessions.updatedAt))
    .limit(limit);
}

/** Eén chat sessie ophalen op sessionId, inclusief berichten. */
export async function getSession(sessionId: string): Promise<ChatSessionFull | null> {
  const rows = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.sessionId, sessionId))
    .limit(1);
  return rows[0] ?? null;
}

/** Chat sessie verwijderen op sessionId. Geeft true als verwijderd. */
export async function deleteSession(sessionId: string): Promise<boolean> {
  const result = await db
    .delete(chatSessions)
    .where(eq(chatSessions.sessionId, sessionId))
    .returning({ id: chatSessions.id });
  return result.length > 0;
}
