"use client";

import { getToolName, isToolUIPart, type UIMessage } from "ai";
import { Bot, Brain, ExternalLink, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/src/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/src/components/ai-elements/message";
import { Suggestion, Suggestions } from "@/src/components/ai-elements/suggestion";
import { ChatToolCall } from "./chat-tool-call";
import { KandidaatGenUICard, MatchGenUICard, OpdrachtGenUICard, ToolErrorBlock } from "./genui";

const GENUI_COMPONENTS: Record<string, React.ComponentType<{ output: unknown }>> = {
  getOpdrachtDetail: OpdrachtGenUICard,
  getKandidaatDetail: KandidaatGenUICard,
  getMatchDetail: MatchGenUICard,
};

type Props = {
  messages: UIMessage[];
  status: string;
  onSuggestion?: (text: string) => void;
};

const EXAMPLE_PROMPTS = [
  "Hoeveel vacatures per platform?",
  "Zoek Java vacatures in Utrecht",
  "Toon alle kandidaten",
  "Wat zijn de gemiddelde tarieven?",
  "Hoeveel pending matches zijn er?",
  "Start de Flextender scraper",
];

function ReasoningBlock({ text, state }: { text: string; state?: "streaming" | "done" }) {
  const hasContent = text.length > 0;
  const [expanded, setExpanded] = useState(hasContent || state === "streaming");

  if (!hasContent && state !== "streaming") return null;

  return (
    <div className="my-2 rounded-lg border border-border bg-muted/50">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-muted/50"
      >
        <Brain className="h-4 w-4 shrink-0" />
        <span>Redenering</span>
        {state === "streaming" && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />}
        <span className="ml-auto text-xs">{expanded ? "Inklappen" : "Uitklappen"}</span>
      </button>
      {expanded && (
        <div className="border-t border-border px-3 py-2">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {text}
            {state === "streaming" && (
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary align-middle" />
            )}
          </p>
        </div>
      )}
    </div>
  );
}

function SourceUrlBlock({ url, title }: { url: string; title: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="my-1 flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
    >
      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{title}</span>
    </a>
  );
}

function SourceDocumentBlock({ title, mediaType }: { title: string; mediaType: string }) {
  return (
    <div className="my-1 flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <FileText className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{title}</span>
      {mediaType && (
        <span className="rounded bg-background px-1.5 py-0.5 text-[10px]">{mediaType}</span>
      )}
    </div>
  );
}

export function ChatMessages({ messages, status, onSuggestion }: Props) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <ConversationEmptyState
          icon={<Bot className="h-8 w-8" />}
          title="Motian AI"
          description="Beheer vacatures, kandidaten, matches, sollicitaties, interviews en berichten. Analyseer data en start scrapers."
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
              {message.parts.map((part, partIndex) => {
                const partKey = `${message.id}-${partIndex}`;
                if (part.type === "text") {
                  if (message.role === "user") {
                    return (
                      <p key={partKey} className="whitespace-pre-wrap leading-relaxed">
                        {part.text}
                      </p>
                    );
                  }
                  return <MessageResponse key={partKey}>{part.text}</MessageResponse>;
                }

                if (part.type === "reasoning") {
                  const reasoningPart = part as {
                    type: "reasoning";
                    text: string;
                    state?: "streaming" | "done";
                  };
                  return (
                    <ReasoningBlock
                      key={partKey}
                      text={reasoningPart.text}
                      state={reasoningPart.state}
                    />
                  );
                }

                if (part.type === "source-url") {
                  const sourcePart = part as {
                    type: "source-url";
                    sourceId: string;
                    url: string;
                    title?: string;
                  };
                  return (
                    <SourceUrlBlock
                      key={partKey}
                      url={sourcePart.url}
                      title={sourcePart.title ?? sourcePart.url}
                    />
                  );
                }

                if (part.type === "source-document") {
                  const docPart = part as {
                    type: "source-document";
                    sourceId: string;
                    mediaType: string;
                    title: string;
                  };
                  return (
                    <SourceDocumentBlock
                      key={partKey}
                      title={docPart.title}
                      mediaType={docPart.mediaType}
                    />
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
                  const name = toolPart.toolName ?? getToolName(part);
                  const GenUICard = name ? GENUI_COMPONENTS[name] : undefined;
                  const isErrorOutput =
                    toolPart.output &&
                    typeof toolPart.output === "object" &&
                    "error" in toolPart.output;

                  if (toolPart.state === "output-error") {
                    const msg =
                      toolPart.output &&
                      typeof toolPart.output === "object" &&
                      "error" in toolPart.output &&
                      typeof (toolPart.output as { error: unknown }).error === "string"
                        ? (toolPart.output as { error: string }).error
                        : "Er is iets misgegaan bij deze actie.";
                    return <ToolErrorBlock key={partKey} message={msg} />;
                  }
                  if (
                    toolPart.state === "output-available" &&
                    GenUICard &&
                    toolPart.output !== undefined
                  ) {
                    if (isErrorOutput) {
                      const msg =
                        typeof (toolPart.output as { error: unknown }).error === "string"
                          ? (toolPart.output as { error: string }).error
                          : "Niet gevonden.";
                      return <ToolErrorBlock key={partKey} message={msg} />;
                    }
                    return <GenUICard key={partKey} output={toolPart.output} />;
                  }
                  return (
                    <ChatToolCall
                      key={partKey}
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
