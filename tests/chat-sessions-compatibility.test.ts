import type { UIMessage } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockDb,
  mockDeleteReturning,
  mockInsertOnConflictDoUpdate,
  mockSelectLimit,
  mockTransaction,
  mockUpdateSet,
} = vi.hoisted(() => {
  const mockDeleteReturning = vi.fn();
  const mockInsertOnConflictDoUpdate = vi.fn();
  const mockSelectLimit = vi.fn();
  const mockTransaction = vi.fn();
  const mockUpdateSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  const mockDb = {
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: mockDeleteReturning }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({ onConflictDoUpdate: mockInsertOnConflictDoUpdate }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: mockSelectLimit }),
      }),
    }),
    transaction: mockTransaction,
    update: vi.fn().mockReturnValue({
      set: mockUpdateSet,
    }),
  };

  return {
    mockDb,
    mockDeleteReturning,
    mockInsertOnConflictDoUpdate,
    mockSelectLimit,
    mockTransaction,
    mockUpdateSet,
  };
});

vi.mock("@motian/db", () => ({
  db: mockDb,
}));

import {
  deleteSession,
  getRecentMessagesForContext,
  getSession,
  isChatSessionMessagesTableMissing,
  persistMessages,
} from "../src/services/chat-sessions.js";

function buildMessage(id: string, role: UIMessage["role"], text: string): UIMessage {
  return {
    id,
    role,
    parts: [{ type: "text", text }],
  } as UIMessage;
}

function missingChatSessionMessagesError(): Error & { code: string } {
  return Object.assign(new Error('relation "chat_session_messages" does not exist'), {
    code: "42P01",
  });
}

describe("chat session compatibility fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertOnConflictDoUpdate.mockResolvedValue(undefined);
  });

  it("recognizes missing chat_session_messages relation errors", () => {
    expect(isChatSessionMessagesTableMissing(missingChatSessionMessagesError())).toBe(true);
    expect(isChatSessionMessagesTableMissing(new Error("other failure"))).toBe(false);
  });

  it("reads recent context from legacy chat_sessions.messages when the new table is missing", async () => {
    mockTransaction.mockRejectedValueOnce(missingChatSessionMessagesError());
    mockSelectLimit.mockResolvedValueOnce([
      {
        messages: [
          buildMessage("u-1", "user", "Hallo"),
          buildMessage("a-1", "assistant", "Hoi terug"),
          buildMessage("u-2", "user", "Vertel meer"),
        ],
      },
    ]);

    const messages = await getRecentMessagesForContext("session-1", 2);

    expect(messages.map((message) => message.id)).toEqual(["a-1", "u-2"]);
    expect(
      messages.map(
        (message) => (message.metadata as { persistedOrderIndex: number }).persistedOrderIndex,
      ),
    ).toEqual([2, 3]);
  });

  it("returns paginated legacy session history when the new table is missing", async () => {
    mockTransaction.mockRejectedValueOnce(missingChatSessionMessagesError());
    mockSelectLimit.mockResolvedValueOnce([
      {
        id: "row-1",
        sessionId: "session-1",
        title: "Legacy chat",
        lastMessagePreview: null,
        messageCount: 0,
        context: { route: "/chat" },
        updatedAt: null,
        createdAt: null,
        messages: [
          buildMessage("u-1", "user", "Hallo"),
          buildMessage("a-1", "assistant", "Hoi"),
          buildMessage("u-2", "user", "Meer context"),
        ],
      },
    ]);

    const page = await getSession("session-1", { limit: 2 });

    expect(page?.messages.map((message) => message.id)).toEqual(["a-1", "u-2"]);
    expect(page?.hasMore).toBe(true);
    expect(page?.nextCursor).toBe("2");
    expect(page?.session.sessionId).toBe("session-1");
  });

  it("persists via legacy chat_sessions.messages when the new table is missing", async () => {
    mockTransaction.mockRejectedValueOnce(missingChatSessionMessagesError());
    mockSelectLimit.mockResolvedValueOnce([
      {
        messages: [buildMessage("u-1", "user", "Hallo daar")],
      },
    ]);

    await persistMessages({
      sessionId: "session-1",
      context: { route: "/chat", sessionId: "session-1" },
      messages: [buildMessage("a-1", "assistant", "Hoi terug")],
    });

    expect(mockUpdateSet).toHaveBeenCalledTimes(1);

    const updatePayload = mockUpdateSet.mock.calls[0]?.[0] as {
      context: { route: string; sessionId: string };
      lastMessagePreview: string | null;
      messageCount: number;
      messages: UIMessage[];
      updatedAt: Date;
    };

    expect(updatePayload.messages.map((message) => message.id)).toEqual(["u-1", "a-1"]);
    expect(updatePayload.messageCount).toBe(2);
    expect(updatePayload.lastMessagePreview).toBe("Hallo daar");
    expect(updatePayload.context).toEqual({ route: "/chat", sessionId: "session-1" });
    expect(updatePayload.updatedAt).toBeInstanceOf(Date);
  });

  it("deletes the session even when the new table is missing", async () => {
    mockTransaction.mockRejectedValueOnce(missingChatSessionMessagesError());
    mockDeleteReturning.mockResolvedValueOnce([{ id: "row-1" }]);

    await expect(deleteSession("session-1")).resolves.toBe(true);
  });
});
