"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import { nanoid } from "nanoid";
import { useCallback, useState } from "react";
import {
  PromptInput,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/src/components/ai-elements/prompt-input";
import { useChatContext } from "./chat-context-provider";
import { ChatHistorySidebar } from "./chat-history-sidebar";
import { ChatMessages } from "./chat-messages";

function ChatSession({
  sessionId,
  initialMessages,
  ctx,
}: {
  sessionId: string;
  initialMessages?: UIMessage[];
  ctx: { route: string; entityId: string | null; entityType: string | null };
}) {
  const { messages, sendMessage, status, stop } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: {
        context: {
          route: ctx.route,
          entityId: ctx.entityId,
          entityType: ctx.entityType,
          sessionId,
        },
      },
    }),
  });

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      const text = message.text.trim();
      if (!text) return;
      sendMessage({ text });
    },
    [sendMessage],
  );

  return (
    <>
      <ChatMessages
        messages={messages}
        status={status}
        onSuggestion={(text) => sendMessage({ text })}
      />
      <div className="border-t border-border p-3">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea placeholder="Stel een vraag..." />
          <PromptInputFooter>
            <div />
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </>
  );
}

export function ChatPageContent() {
  const ctx = useChatContext();
  const [sessionId, setSessionId] = useState(() => nanoid());
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | undefined>();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleSelectSession = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/chat-sessies/${id}`);
      if (res.ok) {
        const session = await res.json();
        setInitialMessages(session.messages ?? []);
        setSessionId(id);
      }
    } catch {
      // If fetch fails, just start a fresh session with that ID
      setInitialMessages(undefined);
      setSessionId(id);
    }
  }, []);

  const handleNewSession = useCallback(() => {
    setInitialMessages(undefined);
    setSessionId(nanoid());
  }, []);

  return (
    <div className="flex h-[calc(100vh-var(--sidebar-height,0px))]">
      {/* History sidebar — desktop only */}
      {sidebarOpen && (
        <ChatHistorySidebar
          activeSessionId={sessionId}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSession}
        />
      )}

      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
              title="Gesprekken"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                role="img"
                aria-label="Gesprekken menu"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <span className="text-sm font-semibold text-foreground">Motian AI</span>
          </div>
        </header>

        {/* Chat session — key forces remount = clean state */}
        <ChatSession
          key={sessionId}
          sessionId={sessionId}
          initialMessages={initialMessages}
          ctx={ctx}
        />
      </div>
    </div>
  );
}
