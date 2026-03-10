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
    execute: vi.fn().mockResolvedValue(undefined),
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

function createNormalizedPersistTx() {
  const sessionOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const sessionValues = vi.fn(() => ({ onConflictDoUpdate: sessionOnConflictDoUpdate }));
  const messageOnConflictDoNothing = vi.fn().mockResolvedValue(undefined);
  const messageValues = vi.fn(() => ({ onConflictDoNothing: messageOnConflictDoNothing }));
  const updateSet = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
  const selectResults = [[{ existingCount: 1 }], [], [{ maxOrderIndex: 1 }], [{ messageCount: 2 }]];

  return {
    tx: {
      execute: vi.fn().mockResolvedValue(undefined),
      insert: vi.fn((table: { __table: string }) => ({
        values: table.__table === "chatSessions" ? sessionValues : messageValues,
      })),
      select: vi.fn(() => ({
        from: vi.fn(() => createResolvedChain(selectResults.shift() ?? [])),
      })),
      update: vi.fn(() => ({ set: updateSet })),
    },
    messageOnConflictDoNothing,
    sessionOnConflictDoUpdate,
    sessionValues,
    updateSet,
  };
}

function createLegacyPersistTx(existingMessages: UIMessage[]) {
  const sessionOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const sessionValues = vi.fn(() => ({ onConflictDoUpdate: sessionOnConflictDoUpdate }));
  const updateSet = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));

  return {
    tx: {
      execute: vi.fn().mockResolvedValue(undefined),
      insert: vi.fn(() => ({ values: sessionValues })),
      select: vi.fn(() => ({
        from: vi.fn(() => createResolvedChain([{ messages: existingMessages }])),
      })),
      update: vi.fn(() => ({ set: updateSet })),
    },
    sessionOnConflictDoUpdate,
    sessionValues,
    updateSet,
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
      execute: vi.fn().mockResolvedValue(undefined),
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

  it("preserves normalized session context when context is omitted", async () => {
    const { tx, sessionValues, sessionOnConflictDoUpdate, updateSet } = createNormalizedPersistTx();

    mockDb.transaction.mockImplementationOnce(async (callback: TransactionCallback) =>
      callback(tx),
    );

    const { persistMessages } = await import("../src/services/chat-sessions");
    await persistMessages({
      sessionId: "session-1",
      messages: [createMessage("m2", "user", "Nieuwe vraag")],
    });

    expect(sessionValues.mock.calls[0]?.[0]).not.toHaveProperty("context");
    expect(sessionOnConflictDoUpdate.mock.calls[0]?.[0].set).not.toHaveProperty("context");
    expect(updateSet.mock.calls[0]?.[0]).not.toHaveProperty("context");
  });

  it("preserves legacy session context when context is omitted after fallback", async () => {
    const existingMessages = [createMessage("m1", "assistant", "Bestaand antwoord")];
    const { tx, sessionValues, sessionOnConflictDoUpdate, updateSet } =
      createLegacyPersistTx(existingMessages);

    mockDb.transaction
      .mockImplementationOnce(async (callback: TransactionCallback) =>
        callback(createFailingNormalizedSelectTx()),
      )
      .mockImplementationOnce(async (callback: TransactionCallback) => callback(tx));

    const { persistMessages } = await import("../src/services/chat-sessions");
    await persistMessages({
      sessionId: "session-1",
      messages: [...existingMessages, createMessage("m2", "user", "Nieuwe vraag")],
    });

    const updatedRow = updateSet.mock.calls[0]?.[0];
    expect(sessionValues.mock.calls[0]?.[0]).not.toHaveProperty("context");
    expect(sessionOnConflictDoUpdate.mock.calls[0]?.[0].set).not.toHaveProperty("context");
    expect(updatedRow).not.toHaveProperty("context");
    expect(updatedRow.messageCount).toBe(2);
    expect(updatedRow.messages.map((message: UIMessage) => message.id)).toEqual(["m1", "m2"]);
  });

  it("acquires a per-session lock and ignores duplicate normalized inserts", async () => {
    const { tx, messageOnConflictDoNothing } = createNormalizedPersistTx();

    mockDb.transaction.mockImplementationOnce(async (callback: TransactionCallback) =>
      callback(tx),
    );

    const { persistMessages } = await import("../src/services/chat-sessions");
    await persistMessages({
      sessionId: "session-1",
      context: { route: "/chat" },
      messages: [createMessage("m2", "assistant", "Antwoord")],
    });

    const lockQuery = tx.execute.mock.calls[0]?.[0] as {
      strings?: TemplateStringsArray;
      values?: unknown[];
    };

    expect(tx.execute).toHaveBeenCalledTimes(1);
    expect(lockQuery.strings?.join("")).toContain("pg_advisory_xact_lock");
    expect(lockQuery.values).toEqual(["chat-session-persist:session-1"]);
    expect(messageOnConflictDoNothing).toHaveBeenCalledWith({
      target: [chatSessionMessages.sessionId, chatSessionMessages.messageId],
    });
  });

  it("acquires a per-session lock in the legacy fallback transaction", async () => {
    const existingMessages = [createMessage("m1", "user", "Bestaande vraag")];
    const { tx, updateSet } = createLegacyPersistTx(existingMessages);

    mockDb.transaction
      .mockImplementationOnce(async (callback: TransactionCallback) =>
        callback(createFailingNormalizedSelectTx()),
      )
      .mockImplementationOnce(async (callback: TransactionCallback) => callback(tx));

    const { persistMessages } = await import("../src/services/chat-sessions");
    await persistMessages({
      sessionId: "session-1",
      context: { route: "/chat" },
      messages: [existingMessages[0], createMessage("m2", "user", "Nieuwe vraag")],
    });

    const lockQuery = tx.execute.mock.calls[0]?.[0] as {
      strings?: TemplateStringsArray;
      values?: unknown[];
    };

    expect(tx.execute).toHaveBeenCalledTimes(1);
    expect(lockQuery.strings?.join("")).toContain("pg_advisory_xact_lock");
    expect(lockQuery.values).toEqual(["chat-session-persist:session-1"]);
    expect(updateSet.mock.calls[0]?.[0].messageCount).toBe(2);
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

  it("filters out null and primitive entries from malformed legacy message arrays", async () => {
    const malformedMessages = [
      createMessage("m1", "user", "Valid message"),
      null,
      "invalid string",
      42,
      undefined,
      createMessage("m2", "assistant", "Another valid message"),
      { role: "user" }, // Missing required fields
      [],
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
            lastMessagePreview: "Another valid message",
            messageCount: 0,
            context: null,
            updatedAt: new Date("2024-01-02T00:00:00.000Z"),
            createdAt: new Date("2024-01-01T00:00:00.000Z"),
            messages: malformedMessages,
          },
        ]);
      }),
    }));

    const { getRecentMessagesForContext } = await import("../src/services/chat-sessions");
    const result = await getRecentMessagesForContext("session-1", 10);

    // Should only include the two valid user/assistant messages, filtering out nulls/primitives
    // The function should not throw when encountering null or primitive entries
    expect(result.length).toBeGreaterThan(0);
    const validIds = result.map((m) => m.id).filter((id) => id === "m1" || id === "m2");
    expect(validIds).toEqual(["m1", "m2"]);
    expect(result.some((m) => m.role === "user")).toBe(true);
    expect(result.some((m) => m.role === "assistant")).toBe(true);
  });

  it("detects retryable chat session database errors through nested causes", async () => {
    const { isRetryableChatSessionDatabaseError } = await import("../src/services/chat-sessions");

    expect(
      isRetryableChatSessionDatabaseError({
        cause: Object.assign(new Error("socket closed"), { code: "08006" }),
      }),
    ).toBe(true);
    expect(
      isRetryableChatSessionDatabaseError(
        new Error("duplicate key value violates unique constraint"),
      ),
    ).toBe(false);
  });

  it("retries token usage lookups after transient database errors", async () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    mockDb.select
      .mockImplementationOnce(() => ({
        from: vi.fn(() =>
          createRejectedChain(Object.assign(new Error("timeout expired"), { code: "08006" })),
        ),
      }))
      .mockImplementationOnce(() => ({
        from: vi.fn(() => createResolvedChain([{ tokensUsed: 7 }])),
      }));

    try {
      const { getSessionTokenUsage } = await import("../src/services/chat-sessions");
      const usagePromise = getSessionTokenUsage("session-1");

      await vi.runAllTimersAsync();

      await expect(usagePromise).resolves.toBe(7);
      expect(mockDb.select).toHaveBeenCalledTimes(2);
      expect(warnSpy).toHaveBeenCalledWith(
        "[chat-sessions] getSessionTokenUsage retry 1/2 after transient DB error",
      );
    } finally {
      warnSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});
