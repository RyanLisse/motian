"use client";

import { getToolName, isToolUIPart, type UIMessage } from "ai";
import { Bot } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/src/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/src/components/ai-elements/message";
import { Suggestion, Suggestions } from "@/src/components/ai-elements/suggestion";
import { ChatToolCall } from "./chat-tool-call";

type Props = {
  messages: UIMessage[];
  status: string;
  onSuggestion?: (text: string) => void;
};

const EXAMPLE_PROMPTS = [
  "Hoeveel opdrachten per platform?",
  "Zoek Java opdrachten in Utrecht",
  "Toon alle kandidaten",
  "Wat zijn de gemiddelde tarieven?",
  "Hoeveel pending matches zijn er?",
  "Start de Flextender scraper",
];

export function ChatMessages({ messages, status, onSuggestion }: Props) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <ConversationEmptyState
          icon={<Bot className="h-8 w-8" />}
          title="Motian AI"
          description="Beheer opdrachten, kandidaten, matches, sollicitaties, interviews en berichten. Analyseer data en start scrapers."
        />
        <Suggestions className="justify-center">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <Suggestion
              key={prompt}
              suggestion={prompt}
              onClick={(s) => onSuggestion?.(s)}
              variant="outline"
              size="sm"
              className="text-xs"
            />
          ))}
        </Suggestions>
      </div>
    );
  }

  return (
    <Conversation className="flex-1">
      <ConversationContent className="gap-4 px-4 py-3">
        {messages.map((message) => (
          <Message key={message.id} from={message.role}>
            <MessageContent>
              {message.parts.map((part, i) => {
                if (part.type === "text") {
                  if (message.role === "user") {
                    return (
                      <p key={i} className="whitespace-pre-wrap leading-relaxed">
                        {part.text}
                      </p>
                    );
                  }
                  return <MessageResponse key={i}>{part.text}</MessageResponse>;
                }

                if (isToolUIPart(part)) {
                  const toolPart = part as {
                    type: string;
                    toolName?: string;
                    state: string;
                    input?: unknown;
                    output?: unknown;
                  };
                  const name = toolPart.toolName ?? getToolName(part);
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
            </MessageContent>
          </Message>
        ))}

        {(status === "streaming" || status === "submitted") &&
          messages.at(-1)?.role !== "assistant" && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
              Denkt na...
            </div>
          )}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
