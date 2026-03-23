import type { UIMessage } from "ai";
import { and, db, desc, eq, inArray, lt, or, sql } from "../db";
import { chatSessionMessages, chatSessions } from "../db/schema";

export const CHAT_HISTORY_PAGE_SIZE = 20;
export const CHAT_CONTEXT_WINDOW_SIZE = 24;

const CHAT_SESSION_MESSAGES_TABLE = "chat_session_messages";
const POSTGRES_MISSING_RELATION_ERROR_CODE = "42P01";
const RETRYABLE_DATABASE_ERROR_CODES = new Set([
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "08007",
  "08P01",
  "53300",
  "57P01",
  "57P02",
  "57P03",
]);
const RETRYABLE_DATABASE_ERROR_PATTERNS = [
  /connection terminated due to connection timeout/i,
  /terminating connection due to administrator command/i,
  /connection terminated unexpectedly/i,
  /timeout expired/i,
  /too many clients/i,
  /remaining connection slots are reserved/i,
  /connection timeout/i,
  /econnreset/i,
  /etimedout/i,
];
const CHAT_SESSION_DB_RETRY_ATTEMPTS = 3;
const CHAT_SESSION_DB_RETRY_DELAY_MS = 150;

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

type ChatSessionMessagesMode = "unknown" | "normalized" | "legacy";

let chatSessionMessagesMode: ChatSessionMessagesMode = "unknown";

const chatSessionSummarySelection = {
  id: chatSessions.id,
  sessionId: chatSessions.sessionId,
  title: chatSessions.title,
  lastMessagePreview: chatSessions.lastMessagePreview,
  messageCount: chatSessions.messageCount,
  context: chatSessions.context,
  updatedAt: chatSessions.updatedAt,
  createdAt: chatSessions.createdAt,
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

function getToolPartFallbackState(part: Record<string, unknown>): string | undefined {
  if (typeof part.state === "string" && part.state.length > 0) return part.state;
  if (typeof part.errorText === "string" && part.errorText.length > 0) return "output-error";
  if (part.output !== undefined) return "output-available";
  if (part.approval && typeof part.approval === "object") return "approval-requested";
  if (part.input !== undefined || part.rawInput !== undefined) return "input-available";
  return undefined;
}

function normalizeMessagePart(part: UIMessage["parts"][number]): UIMessage["parts"][number] {
  if (
    typeof part !== "object" ||
    part == null ||
    !(
      part.type === "dynamic-tool" ||
      (typeof part.type === "string" && part.type.startsWith("tool-"))
    )
  ) {
    return part;
  }

  const normalizedState = getToolPartFallbackState(part as Record<string, unknown>);
  if (!normalizedState) return part;

  return {
    ...part,
    state: normalizedState,
  } as UIMessage["parts"][number];
}

export function normalizeChatMessage(message: UIMessage, fallbackId: string): UIMessage {
  return {
    ...message,
    id: typeof message.id === "string" && message.id.length > 0 ? message.id : fallbackId,
    parts: Array.isArray(message.parts) ? message.parts.map(normalizeMessagePart) : message.parts,
  };
}

function getContextWriteValues(context: ChatSessionContext | null | undefined) {
  return context === undefined ? {} : { context: context ?? {} };
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

export function isChatSessionMessagesTableMissing(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? error.code : undefined;
  const relation = "relation" in error ? error.relation : undefined;
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  const cause = "cause" in error ? error.cause : undefined;

  return (
    (code === POSTGRES_MISSING_RELATION_ERROR_CODE &&
      (relation === CHAT_SESSION_MESSAGES_TABLE ||
        message.includes(CHAT_SESSION_MESSAGES_TABLE))) ||
    (cause ? isChatSessionMessagesTableMissing(cause) : false)
  );
}

export function isRetryableChatSessionDatabaseError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? error.code : undefined;
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  const cause = "cause" in error ? error.cause : undefined;

  return (
    (typeof code === "string" && RETRYABLE_DATABASE_ERROR_CODES.has(code)) ||
    RETRYABLE_DATABASE_ERROR_PATTERNS.some((pattern) => pattern.test(message)) ||
    (cause ? isRetryableChatSessionDatabaseError(cause) : false)
  );
}

async function waitForRetry(delayMs: number) {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function withChatSessionDatabaseRetry<T>(
  label: string,
  operation: () => Promise<T>,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= CHAT_SESSION_DB_RETRY_ATTEMPTS; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (
        attempt === CHAT_SESSION_DB_RETRY_ATTEMPTS ||
        !isRetryableChatSessionDatabaseError(error)
      ) {
        throw error;
      }

      const delayMs = CHAT_SESSION_DB_RETRY_DELAY_MS * attempt;
      console.warn(
        `[chat-sessions] ${label} retry ${attempt}/${CHAT_SESSION_DB_RETRY_ATTEMPTS - 1} after transient DB error`,
      );
      await waitForRetry(delayMs);
    }
  }

  throw lastError;
}

async function withChatSessionMessageCompatibility<T>(
  readNormalized: () => Promise<T>,
  readLegacy: () => Promise<T>,
): Promise<T> {
  if (chatSessionMessagesMode === "legacy") {
    return readLegacy();
  }

  try {
    const result = await readNormalized();
    chatSessionMessagesMode = "normalized";
    return result;
  } catch (error) {
    if (!isChatSessionMessagesTableMissing(error)) {
      throw error;
    }

    chatSessionMessagesMode = "legacy";
    return readLegacy();
  }
}

function getPersistableMessages(messages: UIMessage[], sessionId: string): UIMessage[] {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message, index) => normalizeChatMessage(message, `${sessionId}-msg-${index + 1}`));
}

function getLegacySessionMessages(messages: unknown, sessionId: string): UIMessage[] {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  return messages
    .filter((message): message is UIMessage => {
      if (typeof message !== "object" || message === null) {
        return false;
      }
      const role = (message as { role?: unknown }).role;
      return role === "user" || role === "assistant";
    })
    .map((message, index) => normalizeChatMessage(message, `legacy-${sessionId}-${index + 1}`));
}

function paginateLegacyMessages(
  messages: UIMessage[],
  limit: number,
  cursor: number | null,
): Pick<ChatSessionPage, "messages" | "nextCursor" | "hasMore"> {
  const endExclusive = cursor
    ? Math.min(Math.max(cursor - 1, 0), messages.length)
    : messages.length;
  const eligibleMessages = messages.slice(0, endExclusive);
  const hasMore = eligibleMessages.length > limit;
  const pageMessages = hasMore
    ? eligibleMessages.slice(eligibleMessages.length - limit)
    : eligibleMessages;
  const firstOrderIndex = endExclusive - pageMessages.length + 1;

  return {
    messages: pageMessages.map((message, index) =>
      toPersistedMessage(message, firstOrderIndex + index),
    ),
    nextCursor: hasMore ? encodeMessageCursor(firstOrderIndex) : null,
    hasMore,
  };
}

async function insertChatSessionMessagesIgnoringDuplicates(query: unknown) {
  if (
    typeof query === "object" &&
    query !== null &&
    "onConflictDoNothing" in query &&
    typeof query.onConflictDoNothing === "function"
  ) {
    await query.onConflictDoNothing({
      target: [chatSessionMessages.sessionId, chatSessionMessages.messageId],
    });
    return;
  }

  await query;
}

async function migrateLegacySessionMessagesToNormalizedStore(sessionId: string) {
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

    const legacyMessages = getLegacySessionMessages(session?.messages, sessionId);

    if (legacyMessages.length === 0) {
      if (session) {
        await tx
          .update(chatSessions)
          .set({ messages: [], updatedAt: new Date() })
          .where(eq(chatSessions.sessionId, sessionId));
      }
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
  const normalized = normalizeChatMessage(
    message as UIMessage & { metadata?: unknown },
    `persisted-${orderIndex}`,
  ) as UIMessage & { metadata?: unknown };

  return {
    ...normalized,
    metadata: {
      ...getSafeMetadata(normalized.metadata),
      persistedOrderIndex: orderIndex,
    } satisfies PersistedChatMetadata,
  };
}

export async function listSessions(options?: {
  limit?: number;
  cursor?: string | null;
}): Promise<ChatSessionListPage> {
  return withChatSessionDatabaseRetry("listSessions", async () => {
    const limit = options?.limit ?? CHAT_HISTORY_PAGE_SIZE;
    const cursor = decodeSessionListCursor(options?.cursor);

    const rows = await db
      .select(chatSessionSummarySelection)
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
  });
}

export async function getSessionTokenUsage(sessionId: string): Promise<number> {
  return withChatSessionDatabaseRetry("getSessionTokenUsage", async () => {
    const [row] = await db
      .select({ tokensUsed: chatSessions.tokensUsed })
      .from(chatSessions)
      .where(eq(chatSessions.sessionId, sessionId))
      .limit(1);

    return row?.tokensUsed ?? 0;
  });
}

export async function getSessionRequestSnapshot(sessionId: string): Promise<{
  messageCount: number;
  tokensUsed: number;
}> {
  return withChatSessionDatabaseRetry("getSessionRequestSnapshot", async () => {
    const [row] = await db
      .select({
        messageCount: chatSessions.messageCount,
        tokensUsed: chatSessions.tokensUsed,
        legacyCount: sql<number>`coalesce(jsonb_array_length(${chatSessions.messages}), 0)`,
      })
      .from(chatSessions)
      .where(eq(chatSessions.sessionId, sessionId))
      .limit(1);

    return {
      messageCount: Math.max(row?.messageCount ?? 0, row?.legacyCount ?? 0),
      tokensUsed: row?.tokensUsed ?? 0,
    };
  });
}

export async function getRecentMessagesForContext(
  sessionId: string,
  limit = CHAT_CONTEXT_WINDOW_SIZE,
): Promise<UIMessage[]> {
  return withChatSessionDatabaseRetry("getRecentMessagesForContext", async () => {
    return withChatSessionMessageCompatibility(
      async () => {
        await migrateLegacySessionMessagesToNormalizedStore(sessionId);

        const rows = await db
          .select({
            message: chatSessionMessages.message,
            orderIndex: chatSessionMessages.orderIndex,
          })
          .from(chatSessionMessages)
          .where(eq(chatSessionMessages.sessionId, sessionId))
          .orderBy(desc(chatSessionMessages.orderIndex))
          .limit(limit);

        return [...rows].reverse().map((row) => toPersistedMessage(row.message, row.orderIndex));
      },
      async () => {
        const [session] = await db
          .select({ messages: chatSessions.messages })
          .from(chatSessions)
          .where(eq(chatSessions.sessionId, sessionId))
          .limit(1);

        const legacyMessages = getLegacySessionMessages(session?.messages, sessionId);
        const offset = Math.max(legacyMessages.length - limit, 0);

        return legacyMessages
          .slice(offset)
          .map((message, index) => toPersistedMessage(message, offset + index + 1));
      },
    );
  });
}

export async function persistMessages({ sessionId, context, messages }: PersistMessagesInput) {
  const normalizedMessages = getPersistableMessages(messages, sessionId);
  const contextWriteValues = getContextWriteValues(context);

  if (normalizedMessages.length === 0) {
    return;
  }

  await withChatSessionDatabaseRetry("persistMessages", async () => {
    await withChatSessionMessageCompatibility(
      async () => {
        await db.transaction(async (tx) => {
          await tx
            .insert(chatSessions)
            .values({
              sessionId,
              messages: [],
              messageCount: 0,
              lastMessagePreview: null,
              ...contextWriteValues,
            })
            .onConflictDoUpdate({
              target: chatSessions.sessionId,
              set: {
                updatedAt: new Date(),
                ...contextWriteValues,
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

            const legacyMessages = getLegacySessionMessages(legacySession?.messages, sessionId);

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
          const pendingMessages = normalizedMessages.filter(
            (message) => !existingIds.has(message.id),
          );

          if (pendingMessages.length > 0) {
            const [{ maxOrderIndex }] = await tx
              .select({
                maxOrderIndex: sql<number>`coalesce(max(${chatSessionMessages.orderIndex}), 0)`,
              })
              .from(chatSessionMessages)
              .where(eq(chatSessionMessages.sessionId, sessionId));

            await insertChatSessionMessagesIgnoringDuplicates(
              tx.insert(chatSessionMessages).values(
                pendingMessages.map((message, index) => ({
                  sessionId,
                  messageId: message.id,
                  role: message.role,
                  message,
                  orderIndex: (maxOrderIndex ?? 0) + index + 1,
                })),
              ),
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
              messages: [],
              messageCount: messageCount ?? 0,
              updatedAt: new Date(),
              ...contextWriteValues,
              ...(preview ? { lastMessagePreview: preview } : {}),
            })
            .where(eq(chatSessions.sessionId, sessionId));
        });
      },
      async () => {
        await db.transaction(async (tx) => {
          await tx
            .insert(chatSessions)
            .values({
              sessionId,
              messages: [],
              messageCount: 0,
              lastMessagePreview: null,
              ...contextWriteValues,
            })
            .onConflictDoUpdate({
              target: chatSessions.sessionId,
              set: {
                updatedAt: new Date(),
                ...contextWriteValues,
              },
            });

          const [legacySession] = await tx
            .select({ messages: chatSessions.messages })
            .from(chatSessions)
            .where(eq(chatSessions.sessionId, sessionId))
            .limit(1);

          const existingMessages = getLegacySessionMessages(legacySession?.messages, sessionId);
          const existingIds = new Set(existingMessages.map((message) => message.id));
          const pendingMessages = normalizedMessages.filter(
            (message) => !existingIds.has(message.id),
          );
          const nextMessages = [...existingMessages, ...pendingMessages];
          const preview = getLastUserPreview(normalizedMessages);

          await tx
            .update(chatSessions)
            .set({
              messages: nextMessages,
              messageCount: nextMessages.length,
              updatedAt: new Date(),
              ...contextWriteValues,
              ...(preview ? { lastMessagePreview: preview } : {}),
            })
            .where(eq(chatSessions.sessionId, sessionId));
        });
      },
    );
  });
}

export async function incrementSessionTokens(sessionId: string, delta: number) {
  if (delta <= 0) return;

  await withChatSessionDatabaseRetry("incrementSessionTokens", async () => {
    await db
      .update(chatSessions)
      .set({
        tokensUsed: sql`coalesce(${chatSessions.tokensUsed}, 0) + ${delta}`,
        updatedAt: new Date(),
      })
      .where(eq(chatSessions.sessionId, sessionId));
  });
}

export async function getSession(
  sessionId: string,
  options?: { limit?: number; cursor?: string | null },
): Promise<ChatSessionPage | null> {
  return withChatSessionDatabaseRetry("getSession", async () => {
    const limit = options?.limit ?? CHAT_HISTORY_PAGE_SIZE;
    const cursor = decodeMessageCursor(options?.cursor);

    return withChatSessionMessageCompatibility(
      async () => {
        await migrateLegacySessionMessagesToNormalizedStore(sessionId);

        const [session] = await db
          .select(chatSessionSummarySelection)
          .from(chatSessions)
          .where(eq(chatSessions.sessionId, sessionId))
          .limit(1);

        if (!session) {
          return null;
        }

        const rows = await db
          .select({
            message: chatSessionMessages.message,
            orderIndex: chatSessionMessages.orderIndex,
          })
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

        return {
          session,
          messages: [...pageRows]
            .reverse()
            .map((row) => toPersistedMessage(row.message, row.orderIndex)),
          nextCursor: hasMore && lastPageRow ? encodeMessageCursor(lastPageRow.orderIndex) : null,
          hasMore,
        };
      },
      async () => {
        const [session] = await db
          .select({ ...chatSessionSummarySelection, messages: chatSessions.messages })
          .from(chatSessions)
          .where(eq(chatSessions.sessionId, sessionId))
          .limit(1);

        if (!session) {
          return null;
        }

        const { messages: _messages, ...sessionSummary } = session;
        const legacyMessages = getLegacySessionMessages(session.messages, sessionId);
        const page = paginateLegacyMessages(legacyMessages, limit, cursor);

        return {
          session: {
            ...sessionSummary,
            messageCount: legacyMessages.length,
          },
          ...page,
        };
      },
    );
  });
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  const result = await withChatSessionDatabaseRetry("deleteSession", async () => {
    return withChatSessionMessageCompatibility(
      async () => {
        return db.transaction(async (tx) => {
          await tx.delete(chatSessionMessages).where(eq(chatSessionMessages.sessionId, sessionId));
          return tx
            .delete(chatSessions)
            .where(eq(chatSessions.sessionId, sessionId))
            .returning({ id: chatSessions.id });
        });
      },
      async () => {
        return db
          .delete(chatSessions)
          .where(eq(chatSessions.sessionId, sessionId))
          .returning({ id: chatSessions.id });
      },
    );
  });

  return Array.isArray(result) && result.length > 0;
}
