"use client";

import { getToolName, isToolUIPart, type UIMessage } from "ai";
import {
  Brain,
  Briefcase,
  ChevronUp,
  ExternalLink,
  FileText,
  Loader2,
  Search,
  Sparkles,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/src/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/src/components/ai-elements/message";
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
  currentOrigin?: string | null;
  onSuggestion?: (text: string) => void;
  hasOlderMessages?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
};

const QUICK_ACTIONS = [
  {
    icon: Search,
    label: "Zoek vacatures",
    prompt: "Zoek Java vacatures in Utrecht",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    icon: Users,
    label: "Toon kandidaten",
    prompt: "Toon alle kandidaten met hun vaardigheden",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    icon: TrendingUp,
    label: "Markt analyse",
    prompt: "Wat zijn de gemiddelde tarieven per platform?",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    icon: Briefcase,
    label: "Matches bekijken",
    prompt: "Hoeveel pending matches zijn er? Toon de top 5.",
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
  {
    icon: Upload,
    label: "CV uploaden",
    prompt: "Hoe kan ik een CV uploaden en een kandidaat aanmaken?",
    color: "text-rose-500",
    bg: "bg-rose-500/10",
  },
  {
    icon: Sparkles,
    label: "Start scraper",
    prompt: "Start de Flextender scraper en geef een status update",
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
  },
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

export function ChatMessages({
  messages,
  status,
  onSuggestion,
  hasOlderMessages = false,
  loadingOlder = false,
  onLoadOlder,
}: Props) {
  const hasUserMessage = messages.some((m) => m.role === "user");

  return (
    <Conversation className="flex-1">
      <ConversationContent
        className={cn(
          "mx-auto w-full max-w-3xl gap-4 px-4 py-6 pb-32 sm:pb-40 relative",
          !hasUserMessage && "flex flex-col justify-center min-h-[calc(100vh-160px)]",
        )}
      >
        {(hasOlderMessages || loadingOlder) && (
          <div className="flex justify-center pb-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onLoadOlder}
              disabled={loadingOlder}
              className="rounded-full"
            >
              {loadingOlder ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
              Oudere berichten laden
            </Button>
          </div>
        )}

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

        {!hasUserMessage && (
          <div
            className={cn(
              "flex w-full max-w-2xl flex-col items-center gap-5 self-center animate-in fade-in slide-in-from-bottom-4",
              messages.length === 0 ? "mt-[2vh]" : "mt-6",
            )}
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center gap-2 text-center mb-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                    Hoe kan ik je helpen?
                  </h2>
                  <p className="max-w-xs text-xs text-muted-foreground sm:max-w-sm sm:text-sm">
                    Zoek vacatures, beheer kandidaten, analyseer data of upload een CV.
                  </p>
                </div>
              </div>
            )}

            {/* Quick action grid */}
            <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3">
              {QUICK_ACTIONS.map((action) => (
                <button
                  type="button"
                  key={action.label}
                  onClick={() => onSuggestion?.(action.prompt)}
                  className="group flex flex-col items-start gap-2 rounded-xl border border-border bg-card/50 px-3.5 py-3 text-left transition-all hover:border-primary/40 hover:bg-accent hover:shadow-sm"
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${action.bg}`}
                  >
                    <action.icon className={`h-4 w-4 ${action.color}`} />
                  </div>
                  <span className="text-xs font-medium text-foreground/80 group-hover:text-foreground">
                    {action.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
