"use client";

import { useEffect, useRef } from "react";
import { isToolUIPart, getToolName, type UIMessage } from "ai";
import { ChatToolCall } from "./chat-tool-call";

type Props = {
  messages: UIMessage[];
  status: string;
  onSuggestion?: (text: string) => void;
};

const EXAMPLE_PROMPTS = [
  "Hoeveel opdrachten per platform?",
  "Zoek Java opdrachten in Utrecht",
  "Wat zijn de gemiddelde tarieven?",
  "Start de Flextender scraper",
];

export function ChatMessages({ messages, status, onSuggestion }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-2xl">🤖</div>
        <p className="text-sm text-[#8e8e8e]">
          Stel een vraag over opdrachten, kandidaten of data.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onSuggestion?.(prompt)}
              className="rounded-full border border-[#2d2d2d] px-3 py-1.5 text-xs text-[#999] transition-colors hover:border-[#10a37f] hover:text-[#ccc] hover:bg-[#10a37f]/10"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={
            message.role === "user" ? "flex justify-end" : "flex justify-start"
          }
        >
          <div
            className={
              message.role === "user"
                ? "max-w-[85%] rounded-2xl rounded-br-md bg-[#10a37f] px-3.5 py-2.5 text-sm text-white"
                : "max-w-[95%] text-sm text-[#ddd]"
            }
          >
            {message.parts.map((part, i) => {
              if (part.type === "text") {
                return (
                  <p key={i} className="whitespace-pre-wrap leading-relaxed">
                    {part.text}
                  </p>
                );
              }

              if (isToolUIPart(part)) {
                const toolPart = part as {
                  type: string;
                  toolName?: string;
                  state: string;
                  input?: unknown;
                  output?: unknown;
                };
                const name =
                  toolPart.toolName ?? getToolName(part as any);
                return (
                  <ChatToolCall
                    key={i}
                    toolName={name}
                    state={toolPart.state}
                    input={toolPart.input}
                    output={toolPart.output}
                  />
                );
              }

              return null;
            })}
          </div>
        </div>
      ))}

      {(status === "streaming" || status === "submitted") && (
        <div className="flex justify-start">
          <div className="flex items-center gap-1.5 text-sm text-[#8e8e8e]">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#10a37f]" />
            Denkt na...
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
