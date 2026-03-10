"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearPersistedChatSession,
  hasPersistedChatSession,
  markPersistedChatSession,
} from "./chat-session-storage";

const HISTORY_PAGE_SIZE = 20;
const MAX_ACTIVE_MESSAGES = 40;

type ChatThreadContext = {
  route: string;
  entityId: string | null;
  entityType: "opdracht" | "kandidaat" | null;
};

type ThreadPageResponse = {
  messages?: UIMessage[];
  nextCursor?: string | null;
  hasMore?: boolean;
};

function mergeMessages(olderMessages: UIMessage[], currentMessages: UIMessage[]): UIMessage[] {
  const merged = [...olderMessages, ...currentMessages];
  const seen = new Set<string>();

  return merged.filter((message) => {
    if (seen.has(message.id)) return false;
    seen.add(message.id);
    return true;
  });
}

export function useChatThread({
  sessionId,
  context,
  modelId,
  speedMode,
  onSessionActivity,
}: {
  sessionId: string;
  context: ChatThreadContext;
  modelId?: string;
  speedMode?: string;
  onSessionActivity?: () => void;
}) {
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [loadingThread, setLoadingThread] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ id, messages }) => ({
          body: {
            id,
            message: messages.at(-1),
            model: modelId,
            speedMode,
            context: {
              route: context.route,
              entityId: context.entityId,
              entityType: context.entityType,
              sessionId,
            },
          },
        }),
      }),
    [context.entityId, context.entityType, context.route, modelId, sessionId, speedMode],
  );

  const { messages, sendMessage, setMessages, status, stop } = useChat({
    id: sessionId,
    transport,
  });

  const loadPage = useCallback(
    async (cursor: string | null, mode: "replace" | "prepend") => {
      const params = new URLSearchParams({ limit: String(HISTORY_PAGE_SIZE) });
      if (cursor) params.set("cursor", cursor);

      const res = await fetch(`/api/chat-sessies/${sessionId}?${params.toString()}`);
      if (res.status === 404) {
        clearPersistedChatSession(sessionId);
        setHistoryCursor(null);
        setHasMoreHistory(false);
        if (mode === "replace") {
          setMessages([]);
        }
        return;
      }

      if (!res.ok) {
        throw new Error("Chatgeschiedenis laden mislukt");
      }

      const page = (await res.json()) as ThreadPageResponse;
      const nextMessages = page.messages ?? [];
      markPersistedChatSession(sessionId);
      setHistoryCursor(page.nextCursor ?? null);
      setHasMoreHistory(Boolean(page.hasMore));
      setMessages((currentMessages) =>
        mode === "prepend" ? mergeMessages(nextMessages, currentMessages) : nextMessages,
      );
    },
    [sessionId, setMessages],
  );

  const refreshLatestPage = useCallback(async () => {
    setLoadingThread(true);
    try {
      await loadPage(null, "replace");
    } finally {
      setLoadingThread(false);
    }
  }, [loadPage]);

  const loadOlder = useCallback(async () => {
    if (!hasMoreHistory || !historyCursor || loadingOlder) {
      return;
    }

    setLoadingOlder(true);
    try {
      await loadPage(historyCursor, "prepend");
    } finally {
      setLoadingOlder(false);
    }
  }, [hasMoreHistory, historyCursor, loadPage, loadingOlder]);

  useEffect(() => {
    let cancelled = false;
    setLoadingThread(true);
    setHistoryCursor(null);
    setHasMoreHistory(false);
    setMessages([]);

    if (!hasPersistedChatSession(sessionId)) {
      setLoadingThread(false);
      return;
    }

    void loadPage(null, "replace")
      .catch((err) => {
        if (!cancelled) {
          console.error("[useChatThread] Initial thread load failed:", err);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingThread(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadPage, sessionId, setMessages]);

  const previousStatusRef = useRef(status);

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    previousStatusRef.current = status;

    if ((previousStatus === "submitted" || previousStatus === "streaming") && status === "ready") {
      markPersistedChatSession(sessionId);
      onSessionActivity?.();
      if (messages.length > MAX_ACTIVE_MESSAGES) {
        void refreshLatestPage().catch((err) => {
          console.error("[useChatThread] Active window refresh failed:", err);
        });
      }
    }
  }, [messages.length, onSessionActivity, refreshLatestPage, sessionId, status]);

  return {
    messages,
    sendMessage,
    setMessages,
    status,
    stop,
    hasMoreHistory,
    loadingOlder,
    loadingThread,
    loadOlder,
    refreshLatestPage,
  };
}
