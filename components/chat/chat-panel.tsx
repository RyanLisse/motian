"use client";

import { useEffect, useState, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MessageSquare, X } from "lucide-react";
import { useChatContext } from "./chat-context-provider";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "./chat-input";

export function ChatPanel() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const ctx = useChatContext();

  const { messages, sendMessage, status } = useChat({
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

  const isLoading = status === "streaming" || status === "submitted";

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || isLoading) return;
      setInput("");
      sendMessage({ text });
    },
    [input, isLoading, sendMessage],
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
          className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#10a37f] text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
          title="Open AI Chat (⌘J)"
        >
          <MessageSquare className="h-5 w-5" />
        </button>
      )}

      {/* Slide-in panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-[400px] flex-col border-l border-[#2d2d2d] bg-[#0d0d0d] shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#2d2d2d] px-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#eee]">Motian AI</span>
            {ctx.entityId && (
              <span className="rounded bg-[#1a1a1a] px-1.5 py-0.5 text-[10px] text-[#8e8e8e]">
                {ctx.entityType}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1.5 text-[#8e8e8e] transition-colors hover:bg-[#222] hover:text-[#eee]"
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
            if (!isLoading) {
              sendMessage({ text });
            }
          }}
        />

        {/* Input */}
        <ChatInput
          input={input}
          setInput={setInput}
          onSubmit={handleSubmit}
          isLoading={isLoading}
        />
      </div>
    </>
  );
}
