import type { UIMessage } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { chatSessionMessages, chatSessions, mockDb } = vi.hoisted(() => {
  const chatSessions = {
    __table: "chatSessions",
    id: "chatSessions.id",
    sessionId: "chatSessions.sessionId",
    messages: "chatSessions.messages",
    context: "chatSessions.context",
    messageCount: "chatSessions.messageCount",
    title: "chatSessions.title",
    lastMessagePreview: "chatSessions.lastMessagePreview",
    updatedAt: "chatSessions.updatedAt",
    createdAt: "chatSessions.createdAt",
    tokensUsed: "chatSessions.tokensUsed",
  };

  const chatSessionMessages = {
    __table: "chatSessionMessages",
    sessionId: "chatSessionMessages.sessionId",
    messageId: "chatSessionMessages.messageId",
    message: "chatSessionMessages.message",
    orderIndex: "chatSessionMessages.orderIndex",
    role: "chatSessionMessages.role",
  };

  return {
    chatSessions,
    chatSessionMessages,
    mockDb: {
      delete: vi.fn(),
      insert: vi.fn(),
      select: vi.fn(),
      transaction: vi.fn(),
      update: vi.fn(),
    },
  };
});

vi.mock("../src/db", () => ({ db: mockDb }));
vi.mock("../src/db/schema", () => ({ chatSessionMessages, chatSessions }));
vi.mock("drizzle-orm", () => {
  const sqlTag = (strings: TemplateStringsArray, ...values: unknown[]) => ({
    type: "sql",
    strings,
    values,
  });

  return {
    and: (...args: unknown[]) => ({ type: "and", args }),
    desc: (column: unknown) => ({ type: "desc", column }),
    eq: (column: unknown, value: unknown) => ({ type: "eq", column, value }),
    inArray: (column: unknown, values: unknown[]) => ({ type: "inArray", column, values }),
    lt: (column: unknown, value: unknown) => ({ type: "lt", column, value }),
    or: (...args: unknown[]) => ({ type: "or", args }),
    sql: sqlTag,
  };
});

function createMessage(id: string, role: "user" | "assistant", text: string): UIMessage {
  return { id, role, parts: [{ type: "text", text }] } as UIMessage;
}

function createResolvedChain<T>(result: T) {
  const chain = Object.assign(Promise.resolve(result), {
    limit: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    returning: vi.fn(() => chain),
    where: vi.fn(() => chain),
  });
  return chain;
}

function createRejectedChain(error: unknown) {
  const chain = Object.assign(Promise.reject(error), {
    limit: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    returning: vi.fn(() => chain),
    where: vi.fn(() => chain),
  });
  return chain;
}

function createMissingRelationError() {
  return Object.assign(new Error('relation "chat_session_messages" does not exist'), {
    code: "42P01",
    relation: "chat_session_messages",
  });
}

function createFailingNormalizedSelectTx() {
  const error = createMissingRelationError();

  return {
    delete: vi.fn(),
    insert: vi.fn((table: { __table: string }) => ({
      values: vi.fn(() =>
        table.__table === "chatSessions"
          ? { onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) }
          : createResolvedChain(undefined),
      ),
    })),
    select: vi.fn(() => ({
      from: vi.fn((table: { __table: string }) => {
        if (table.__table === "chatSessionMessages") {
          return createRejectedChain(error);
        }

        return createResolvedChain([]);
      }),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })),
  };
}

function createMissingMessagesDeleteTx() {
  const error = createMissingRelationError();

  return {
    delete: vi.fn((table: { __table: string }) => ({
      where: vi.fn(() =>
        table.__table === "chatSessionMessages"
          ? Promise.reject(error)
          : { returning: vi.fn().mockResolvedValue([{ id: "row-1" }]) },
      ),
    })),
  };
}

type TransactionCallback = (tx: unknown) => Promise<unknown>;

describe("chat session compatibility fallback", () => {
  beforeEach(() => {
    vi.resetModules();
    mockDb.delete.mockReset();
    mockDb.insert.mockReset();
    mockDb.select.mockReset();
    mockDb.transaction.mockReset();
    mockDb.update.mockReset();
  });

  it("returns paginated legacy messages when chat_session_messages is unavailable", async () => {
    const legacyMessages = [
      createMessage("m1", "user", "Hallo"),
      createMessage("m2", "assistant", "Hoi"),
      createMessage("m3", "user", "Kun je helpen?"),
    ];

    mockDb.transaction.mockImplementationOnce(async (callback: TransactionCallback) =>
      callback(createFailingNormalizedSelectTx()),
    );
    mockDb.select.mockImplementation(() => ({
      from: vi.fn((table: { __table: string }) => {
        expect(table).toBe(chatSessions);
        return createResolvedChain([
          {
            id: "row-1",
            sessionId: "session-1",
            title: null,
            lastMessagePreview: "Kun je helpen?",
            messageCount: 0,
            context: { route: "/chat" },
            updatedAt: new Date("2024-01-02T00:00:00.000Z"),
            createdAt: new Date("2024-01-01T00:00:00.000Z"),
            messages: legacyMessages,
          },
        ]);
      }),
    }));

    const { getSession } = await import("../src/services/chat-sessions");
    const session = await getSession("session-1", { limit: 2 });

    expect(session).not.toBeNull();
    expect(session?.session.messageCount).toBe(3);
    expect(session?.messages.map((message) => message.id)).toEqual(["m2", "m3"]);
    expect(session?.messages.map((message) => message.metadata?.persistedOrderIndex)).toEqual([
      2, 3,
    ]);
    expect(session?.nextCursor).toBe("2");
    expect(session?.hasMore).toBe(true);
  });

  it("caches legacy mode for repeated context reads after the first missing-table error", async () => {
    const legacyMessages = [
      createMessage("m1", "user", "Hallo"),
      createMessage("m2", "assistant", "Hoi"),
      createMessage("m3", "assistant", "Waarmee kan ik helpen?"),
    ];

    mockDb.transaction.mockImplementationOnce(async (callback: TransactionCallback) =>
      callback(createFailingNormalizedSelectTx()),
    );
    mockDb.select.mockImplementation(() => ({
      from: vi.fn(() => createResolvedChain([{ messages: legacyMessages }])),
    }));

    const { getRecentMessagesForContext } = await import("../src/services/chat-sessions");
    const first = await getRecentMessagesForContext("session-1", 2);
    const second = await getRecentMessagesForContext("session-1", 2);

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(first.map((message) => message.id)).toEqual(["m2", "m3"]);
    expect(second.map((message) => message.id)).toEqual(["m2", "m3"]);
  });

  it("appends to legacy session storage when chat_session_messages is unavailable", async () => {
    const existingMessages = [createMessage("m1", "user", "Bestaande vraag")];
    const updateSet = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
    const fallbackTx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({ onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) })),
      })),
      select: vi.fn(() => ({
        from: vi.fn(() => createResolvedChain([{ messages: existingMessages }])),
      })),
      update: vi.fn(() => ({ set: updateSet })),
    };

    mockDb.transaction
      .mockImplementationOnce(async (callback: TransactionCallback) =>
        callback(createFailingNormalizedSelectTx()),
      )
      .mockImplementationOnce(async (callback: TransactionCallback) => callback(fallbackTx));

    const { persistMessages } = await import("../src/services/chat-sessions");
    await persistMessages({
      sessionId: "session-1",
      context: { route: "/chat" },
      messages: [existingMessages[0], createMessage("m2", "user", "Nieuwe vraag")],
    });

    const updatedRow = updateSet.mock.calls[0]?.[0];
    expect(mockDb.transaction).toHaveBeenCalledTimes(2);
    expect(updatedRow.messageCount).toBe(2);
    expect(updatedRow.lastMessagePreview).toBe("Nieuwe vraag");
    expect(updatedRow.context).toEqual({ route: "/chat" });
    expect(updatedRow.messages.map((message: UIMessage) => message.id)).toEqual(["m1", "m2"]);
  });

  it("deletes the legacy session row when the normalized message table is unavailable", async () => {
    mockDb.transaction.mockImplementationOnce(async (callback: TransactionCallback) =>
      callback(createMissingMessagesDeleteTx()),
    );
    mockDb.delete.mockImplementation(() => ({
      where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: "row-1" }]) })),
    }));

    const { deleteSession } = await import("../src/services/chat-sessions");
    await expect(deleteSession("session-1")).resolves.toBe(true);
  });
});
