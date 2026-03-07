import type { UIMessage } from "ai";
import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "../db";
import { chatSessionMessages, chatSessions } from "../db/schema";

export const CHAT_HISTORY_PAGE_SIZE = 20;
export const CHAT_CONTEXT_WINDOW_SIZE = 24;

type PersistedChatMetadata = Record<string, unknown> & {
  persistedOrderIndex?: number;
};

export type ChatSessionContext = {
  route?: string | null;
  entityId?: string | null;
  entityType?: "opdracht" | "kandidaat" | null;
  sessionId?: string | null;
};

type SessionListCursor = {
  updatedAt: string;
  sessionId: string;
};

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

export type ChatSessionPage = {
  session: ChatSessionSummary;
  messages: UIMessage[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type ChatSessionListPage = {
  sessions: ChatSessionSummary[];
  nextCursor: string | null;
  hasMore: boolean;
};

type PersistMessagesInput = {
  sessionId: string;
  context?: ChatSessionContext | null;
  messages: UIMessage[];
};

function getSafeMetadata(metadata: unknown): Record<string, unknown> {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

function normalizeMessage(message: UIMessage, fallbackId: string): UIMessage {
  return {
    ...message,
    id: typeof message.id === "string" && message.id.length > 0 ? message.id : fallbackId,
  };
}

function getMessageText(message: UIMessage): string {
  const textParts = Array.isArray(message.parts)
    ? message.parts
        .filter((part): part is Extract<UIMessage["parts"][number], { type: "text" }> => {
          return part.type === "text" && typeof part.text === "string";
        })
        .map((part) => part.text.trim())
        .filter(Boolean)
    : [];

  if (textParts.length > 0) {
    return textParts.join("\n").trim();
  }

  const legacyContent = (message as UIMessage & { content?: unknown }).content;
  return typeof legacyContent === "string" ? legacyContent.trim() : "";
}

export function getLastUserPreview(messages: UIMessage[]): string | null {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
  if (!lastUserMessage) return null;

  const preview = getMessageText(lastUserMessage).slice(0, 100).trim();
  return preview.length > 0 ? preview : null;
}

export function mergeChatMessages(
  olderMessages: UIMessage[],
  currentMessages: UIMessage[],
): UIMessage[] {
  const merged = [...olderMessages, ...currentMessages];
  const seen = new Set<string>();

  return merged.filter((message) => {
    if (seen.has(message.id)) return false;
    seen.add(message.id);
    return true;
  });
}

export function encodeSessionListCursor(updatedAt: Date, sessionId: string): string {
  return Buffer.from(JSON.stringify({ updatedAt: updatedAt.toISOString(), sessionId })).toString(
    "base64url",
  );
}

export function decodeSessionListCursor(cursor?: string | null): SessionListCursor | null {
  if (!cursor) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as SessionListCursor;
    if (typeof parsed.updatedAt !== "string" || typeof parsed.sessionId !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function encodeMessageCursor(orderIndex: number): string {
  return String(orderIndex);
}

export function decodeMessageCursor(cursor?: string | null): number | null {
  if (!cursor) return null;
  const value = Number.parseInt(cursor, 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

async function migrateLegacySessionMessagesIfNeeded(sessionId: string) {
  await db.transaction(async (tx) => {
    const [{ existingCount }] = await tx
      .select({ existingCount: sql<number>`count(*)::int` })
      .from(chatSessionMessages)
      .where(eq(chatSessionMessages.sessionId, sessionId));

    if ((existingCount ?? 0) > 0) {
      return;
    }

    const [session] = await tx
      .select({ messages: chatSessions.messages })
      .from(chatSessions)
      .where(eq(chatSessions.sessionId, sessionId))
      .limit(1);

    if (!session || !Array.isArray(session.messages) || session.messages.length === 0) {
      return;
    }

    const legacyMessages = session.messages
      .map((message, index) =>
        normalizeMessage(message as UIMessage, `legacy-${sessionId}-${index + 1}`),
      )
      .filter((message) => message.role === "user" || message.role === "assistant");

    if (legacyMessages.length === 0) {
      await tx
        .update(chatSessions)
        .set({ messages: [], updatedAt: new Date() })
        .where(eq(chatSessions.sessionId, sessionId));
      return;
    }

    await tx.insert(chatSessionMessages).values(
      legacyMessages.map((message, index) => ({
        sessionId,
        messageId: message.id,
        role: message.role,
        message,
        orderIndex: index + 1,
      })),
    );

    await tx
      .update(chatSessions)
      .set({
        messages: [],
        messageCount: legacyMessages.length,
        lastMessagePreview: getLastUserPreview(legacyMessages),
        updatedAt: new Date(),
      })
      .where(eq(chatSessions.sessionId, sessionId));
  });
}

function toPersistedMessage(message: unknown, orderIndex: number): UIMessage {
  const normalized = message as UIMessage & { metadata?: unknown };
  return {
    ...normalized,
    metadata: {
      ...getSafeMetadata(normalized.metadata),
      persistedOrderIndex: orderIndex,
    } satisfies PersistedChatMetadata,
  };
}

// ========== Service Functions ==========

/** Recente chat sessies ophalen, cursor-paginated op laatst bijgewerkt. */
export async function listSessions(options?: {
  limit?: number;
  cursor?: string | null;
}): Promise<ChatSessionListPage> {
  const limit = options?.limit ?? CHAT_HISTORY_PAGE_SIZE;
  const cursor = decodeSessionListCursor(options?.cursor);

  const rows = await db
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
    .where(
      cursor
        ? or(
            lt(chatSessions.updatedAt, new Date(cursor.updatedAt)),
            and(
              eq(chatSessions.updatedAt, new Date(cursor.updatedAt)),
              lt(chatSessions.sessionId, cursor.sessionId),
            ),
          )
        : undefined,
    )
    .orderBy(desc(chatSessions.updatedAt), desc(chatSessions.sessionId))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const sessions = hasMore ? rows.slice(0, limit) : rows;
  const lastSession = sessions.at(-1);

  return {
    sessions,
    hasMore,
    nextCursor:
      hasMore && lastSession?.updatedAt
        ? encodeSessionListCursor(lastSession.updatedAt, lastSession.sessionId)
        : null,
  };
}

export async function getSessionTokenUsage(sessionId: string): Promise<number> {
  const [row] = await db
    .select({ tokensUsed: chatSessions.tokensUsed })
    .from(chatSessions)
    .where(eq(chatSessions.sessionId, sessionId))
    .limit(1);

  return row?.tokensUsed ?? 0;
}

export async function getRecentMessagesForContext(
  sessionId: string,
  limit = CHAT_CONTEXT_WINDOW_SIZE,
): Promise<UIMessage[]> {
  await migrateLegacySessionMessagesIfNeeded(sessionId);

  const rows = await db
    .select({ message: chatSessionMessages.message, orderIndex: chatSessionMessages.orderIndex })
    .from(chatSessionMessages)
    .where(eq(chatSessionMessages.sessionId, sessionId))
    .orderBy(desc(chatSessionMessages.orderIndex))
    .limit(limit);

  return [...rows].reverse().map((row) => toPersistedMessage(row.message, row.orderIndex));
}

export async function persistMessages({ sessionId, context, messages }: PersistMessagesInput) {
  const normalizedMessages = messages
    .map((message, index) => normalizeMessage(message, `${sessionId}-${Date.now()}-${index + 1}`))
    .filter((message) => message.role === "user" || message.role === "assistant");

  if (normalizedMessages.length === 0) {
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(chatSessions)
      .values({
        sessionId,
        messages: [],
        context: context ?? {},
        messageCount: 0,
        lastMessagePreview: null,
      })
      .onConflictDoUpdate({
        target: chatSessions.sessionId,
        set: {
          context: context ?? {},
          updatedAt: new Date(),
        },
      });

    const [{ existingCount }] = await tx
      .select({ existingCount: sql<number>`count(*)::int` })
      .from(chatSessionMessages)
      .where(eq(chatSessionMessages.sessionId, sessionId));

    if ((existingCount ?? 0) === 0) {
      const [legacySession] = await tx
        .select({ messages: chatSessions.messages })
        .from(chatSessions)
        .where(eq(chatSessions.sessionId, sessionId))
        .limit(1);

      if (
        legacySession &&
        Array.isArray(legacySession.messages) &&
        legacySession.messages.length > 0
      ) {
        const legacyMessages = legacySession.messages
          .map((message, index) =>
            normalizeMessage(message as UIMessage, `legacy-${sessionId}-${index + 1}`),
          )
          .filter((message) => message.role === "user" || message.role === "assistant");

        if (legacyMessages.length > 0) {
          await tx.insert(chatSessionMessages).values(
            legacyMessages.map((message, index) => ({
              sessionId,
              messageId: message.id,
              role: message.role,
              message,
              orderIndex: index + 1,
            })),
          );
        }
      }
    }

    const existingRows = await tx
      .select({ messageId: chatSessionMessages.messageId })
      .from(chatSessionMessages)
      .where(
        and(
          eq(chatSessionMessages.sessionId, sessionId),
          inArray(
            chatSessionMessages.messageId,
            normalizedMessages.map((message) => message.id),
          ),
        ),
      );

    const existingIds = new Set(existingRows.map((row) => row.messageId));
    const pendingMessages = normalizedMessages.filter((message) => !existingIds.has(message.id));

    if (pendingMessages.length > 0) {
      const [{ maxOrderIndex }] = await tx
        .select({ maxOrderIndex: sql<number>`coalesce(max(${chatSessionMessages.orderIndex}), 0)` })
        .from(chatSessionMessages)
        .where(eq(chatSessionMessages.sessionId, sessionId));

      await tx.insert(chatSessionMessages).values(
        pendingMessages.map((message, index) => ({
          sessionId,
          messageId: message.id,
          role: message.role,
          message,
          orderIndex: (maxOrderIndex ?? 0) + index + 1,
        })),
      );
    }

    const [{ messageCount }] = await tx
      .select({ messageCount: sql<number>`count(*)::int` })
      .from(chatSessionMessages)
      .where(eq(chatSessionMessages.sessionId, sessionId));

    const preview = getLastUserPreview(normalizedMessages);

    await tx
      .update(chatSessions)
      .set({
        context: context ?? {},
        messages: [],
        messageCount: messageCount ?? 0,
        updatedAt: new Date(),
        ...(preview ? { lastMessagePreview: preview } : {}),
      })
      .where(eq(chatSessions.sessionId, sessionId));
  });
}

export async function incrementSessionTokens(sessionId: string, delta: number) {
  if (delta <= 0) return;

  await db
    .update(chatSessions)
    .set({
      tokensUsed: sql`coalesce(${chatSessions.tokensUsed}, 0) + ${delta}`,
      updatedAt: new Date(),
    })
    .where(eq(chatSessions.sessionId, sessionId));
}

/** Eén chat sessie ophalen op sessionId, inclusief een lazy-loaded berichtenpagina. */
export async function getSession(
  sessionId: string,
  options?: { limit?: number; cursor?: string | null },
): Promise<ChatSessionPage | null> {
  await migrateLegacySessionMessagesIfNeeded(sessionId);

  const [session] = await db
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
    .where(eq(chatSessions.sessionId, sessionId))
    .limit(1);

  if (!session) return null;

  const limit = options?.limit ?? CHAT_HISTORY_PAGE_SIZE;
  const cursor = decodeMessageCursor(options?.cursor);

  const rows = await db
    .select({ message: chatSessionMessages.message, orderIndex: chatSessionMessages.orderIndex })
    .from(chatSessionMessages)
    .where(
      and(
        eq(chatSessionMessages.sessionId, sessionId),
        cursor ? lt(chatSessionMessages.orderIndex, cursor) : undefined,
      ),
    )
    .orderBy(desc(chatSessionMessages.orderIndex))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const lastPageRow = pageRows.at(-1);
  const nextCursor = hasMore && lastPageRow ? encodeMessageCursor(lastPageRow.orderIndex) : null;

  return {
    session,
    messages: [...pageRows].reverse().map((row) => toPersistedMessage(row.message, row.orderIndex)),
    nextCursor,
    hasMore,
  };
}

/** Chat sessie verwijderen op sessionId. Geeft true als verwijderd. */
export async function deleteSession(sessionId: string): Promise<boolean> {
  const result = await db.transaction(async (tx) => {
    await tx.delete(chatSessionMessages).where(eq(chatSessionMessages.sessionId, sessionId));
    return tx
      .delete(chatSessions)
      .where(eq(chatSessions.sessionId, sessionId))
      .returning({ id: chatSessions.id });
  });

  return result.length > 0;
}
