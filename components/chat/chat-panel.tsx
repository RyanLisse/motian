"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MessageSquare, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  PromptInput,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/src/components/ai-elements/prompt-input";
import { useChatContext } from "./chat-context-provider";
import { ChatMessages } from "./chat-messages";

export function ChatPanel() {
  const [open, setOpen] = useState(false);
  const ctx = useChatContext();

  const { messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: {
        context: {
          route: ctx.route,
          entityId: ctx.entityId,
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

  // Cmd+J / Ctrl+J toggle
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    },
    [open],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      {/* FAB button — visible when panel is closed */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
          title="Open AI Chat (⌘J)"
        >
          <MessageSquare className="h-5 w-5" />
        </button>
      )}

      {/* Slide-in panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-full sm:w-[400px] flex-col border-l border-border bg-background shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Motian AI</span>
            {ctx.entityId && (
              <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {ctx.entityType}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Sluiten (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <ChatMessages
          messages={messages}
          status={status}
          onSuggestion={(text) => {
            sendMessage({ text });
          }}
        />

        {/* Input — AI Elements PromptInput */}
        <div className="border-t border-border p-3">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputTextarea placeholder="Stel een vraag..." />
            <PromptInputFooter>
              <div />
              <PromptInputSubmit status={status} onStop={stop} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </>
  );
}
