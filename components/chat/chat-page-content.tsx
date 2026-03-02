"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback } from "react";
import {
  PromptInput,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/src/components/ai-elements/prompt-input";
import { useChatContext } from "./chat-context-provider";
import { ChatMessages } from "./chat-messages";

export function ChatPageContent() {
  const ctx = useChatContext();

  const { messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: {
        context: {
          route: ctx.route,
          entityId: ctx.entityId,
          entityType: ctx.entityType,
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
    <div className="flex h-[calc(100vh-var(--sidebar-height,0px))] flex-col">
      <header className="flex h-12 shrink-0 items-center border-b border-border px-4">
        <span className="text-sm font-semibold text-foreground">Motian AI</span>
      </header>

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
    </div>
  );
}
