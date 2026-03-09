import { readFileSync } from "node:fs";
import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import {
  clearPersistedChatSession,
  hasPersistedChatSession,
  markPersistedChatSession,
  writeSessionStorage,
} from "../components/chat/chat-session-storage";
import { getPostHogPersistence } from "../src/components/posthog-provider";
import { normalizeChatMessage } from "../src/services/chat-sessions";

function createStorage() {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

function createThrowingStorage() {
  return {
    getItem: () => {
      throw new Error("denied");
    },
    removeItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("denied");
    },
  };
}

describe("chat runtime regressions", () => {
  it("tracks persisted sessions separately from freshly generated session ids", () => {
    const storage = createStorage();

    writeSessionStorage("motian-chat-session", "fresh-session", storage);
    expect(hasPersistedChatSession("fresh-session", storage)).toBe(false);

    markPersistedChatSession("fresh-session", storage);
    expect(hasPersistedChatSession("fresh-session", storage)).toBe(true);

    clearPersistedChatSession("fresh-session", storage);
    expect(hasPersistedChatSession("fresh-session", storage)).toBe(false);
  });

  it("falls back to memory persistence when browser storage access is restricted", () => {
    const workingStorage = createStorage();
    const throwingStorage = createThrowingStorage();

    expect(
      getPostHogPersistence({
        localStorage: workingStorage,
        sessionStorage: workingStorage,
      }),
    ).toBe("localStorage+cookie");

    expect(
      getPostHogPersistence({
        localStorage: workingStorage,
        sessionStorage: throwingStorage,
      }),
    ).toBe("memory");
  });

  it("normalizes persisted tool parts so AI SDK message replay keeps a state field", () => {
    const message = normalizeChatMessage(
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: "tool-searchJobs",
            toolCallId: "tool-1",
            input: { q: "java" },
            output: { jobs: [] },
          },
          {
            type: "dynamic-tool",
            toolCallId: "tool-2",
            toolName: "lookupCandidate",
            input: { id: "candidate-1" },
          },
        ],
      } as UIMessage,
      "fallback-id",
    );

    expect((message.parts[0] as { state?: string }).state).toBe("output-available");
    expect((message.parts[1] as { state?: string }).state).toBe("input-available");
  });

  it("keeps chat runtime ownership in useChatThread and gates history bootstrap to persisted sessions", () => {
    const providerSource = readFileSync(
      new URL("../components/chat/chat-context-provider.tsx", import.meta.url),
      "utf8",
    );
    const threadSource = readFileSync(
      new URL("../components/chat/use-chat-thread.ts", import.meta.url),
      "utf8",
    );

    expect(providerSource).not.toContain("useChat({");
    expect(threadSource).toContain("hasPersistedChatSession(sessionId)");
    expect(threadSource).toContain("markPersistedChatSession(sessionId)");
  });
});
