"use client";

import { type ChatStatus, getToolName, isToolUIPart, type UIMessage } from "ai";
import {
  Brain,
  Briefcase,
  ChevronUp,
  ExternalLink,
  FileText,
  Loader2,
  type LucideIcon,
  Search,
  Sparkles,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";
import { Suspense, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/src/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/src/components/ai-elements/message";
import {
  CHAT_MESSAGE_ALLOWED_TAGS,
  CHAT_MESSAGE_COMPONENTS,
  rewriteChatJobLinks,
} from "./chat-message-links";
import { ChatToolCall } from "./chat-tool-call";
import { ToolErrorBlock } from "./genui";
import { GenUILoadingSkeleton } from "./genui/genui-loading-skeleton";
import { GENUI_REGISTRY } from "./genui/registry";

export type ChatSuggestion = {
  label: string;
  prompt: string;
  description: string;
  icon: LucideIcon;
  toneClassName: string;
};

type ChatMessagesStatus = ChatStatus | "submitted" | "streaming" | "ready" | "error";

type Props = {
  messages: UIMessage[];
  status: ChatMessagesStatus;
  currentOrigin?: string | null;
  onSuggestion?: (text: string) => void;
  layout?: "page" | "widget";
  hasOlderMessages?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  emptyStatePrompts?: ChatSuggestion[];
  followUpPrompts?: ChatSuggestion[];
  conversationLabel?: string;
};

const DEFAULT_EMPTY_STATE_PROMPTS: ChatSuggestion[] = [
  {
    icon: Search,
    label: "Zoek vacatures",
    description: "Start met een concrete zoekopdracht op regio, skill of platform.",
    prompt: "Zoek Java vacatures in Utrecht",
    toneClassName: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  {
    icon: Users,
    label: "Toon kandidaten",
    description: "Vraag om een shortlist of overzicht van relevante profielen.",
    prompt: "Toon alle kandidaten met hun vaardigheden",
    toneClassName: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    icon: TrendingUp,
    label: "Markt analyse",
    description: "Laat Motian trends, tarieven of volumes samenvatten.",
    prompt: "Wat zijn de gemiddelde tarieven per platform?",
    toneClassName: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    icon: Briefcase,
    label: "Matches bekijken",
    description: "Bekijk snel welke kandidaten en vacatures aandacht vragen.",
    prompt: "Hoeveel pending matches zijn er? Toon de top 5.",
    toneClassName: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  {
    icon: Upload,
    label: "CV uploaden",
    description: "Gebruik de composer om een profiel te importeren en te laten samenvatten.",
    prompt: "Hoe kan ik een CV uploaden en een kandidaat aanmaken?",
    toneClassName: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  {
    icon: Sparkles,
    label: "Start scraper",
    description: "Vraag om een scraper-run of een statusupdate van scraping jobs.",
    prompt: "Start de Flextender scraper en geef een status update",
    toneClassName: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  },
];

function ReasoningBlock({ text, state }: { text: string; state?: "streaming" | "done" }) {
  const hasContent = text.length > 0;
  const [expanded, setExpanded] = useState(hasContent || state === "streaming");
  const panelId = useId();

  if (!hasContent && state !== "streaming") return null;

  return (
    <div className="my-2 rounded-lg border border-border bg-muted/50">
      <button
        type="button"
        onClick={() => setExpanded((previous) => !previous)}
        aria-controls={panelId}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-muted/50"
      >
        <Brain className="h-4 w-4 shrink-0" />
        <span>Redenering</span>
        {state === "streaming" ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : null}
        <span className="ml-auto text-xs">{expanded ? "Inklappen" : "Uitklappen"}</span>
      </button>
      {expanded ? (
        <div id={panelId} className="border-t border-border px-3 py-2">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {text}
            {state === "streaming" ? (
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary align-middle" />
            ) : null}
          </p>
        </div>
      ) : null}
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
      {mediaType ? (
        <span className="rounded bg-background px-1.5 py-0.5 text-[10px]">{mediaType}</span>
      ) : null}
    </div>
  );
}

function hasSuggestionHandler(onSelect?: (prompt: string) => void) {
  return typeof onSelect === "function";
}

function SuggestedPromptCard({
  suggestion,
  onSelect,
}: {
  suggestion: ChatSuggestion;
  onSelect?: (prompt: string) => void;
}) {
  const Icon = suggestion.icon;
  const isInteractive = hasSuggestionHandler(onSelect);

  return (
    <button
      type="button"
      onClick={isInteractive ? () => onSelect(suggestion.prompt) : undefined}
      disabled={!isInteractive}
      aria-disabled={!isInteractive}
      className={cn(
        "group flex h-full flex-col items-start gap-3 rounded-2xl border border-border/70 bg-background/80 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isInteractive
          ? "hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent/60 hover:shadow-sm"
          : "cursor-not-allowed opacity-60",
      )}
      aria-label={`${suggestion.label}. ${suggestion.description}`}
    >
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl",
          suggestion.toneClassName,
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-foreground">{suggestion.label}</p>
        <p className="text-xs leading-5 text-muted-foreground">{suggestion.description}</p>
      </div>
    </button>
  );
}

function FollowUpPromptButton({
  suggestion,
  onSelect,
}: {
  suggestion: ChatSuggestion;
  onSelect?: (prompt: string) => void;
}) {
  const Icon = suggestion.icon;
  const isInteractive = hasSuggestionHandler(onSelect);

  return (
    <button
      type="button"
      onClick={isInteractive ? () => onSelect(suggestion.prompt) : undefined}
      disabled={!isInteractive}
      aria-disabled={!isInteractive}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isInteractive ? "hover:border-primary/40 hover:bg-accent" : "cursor-not-allowed opacity-60",
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full",
          suggestion.toneClassName,
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span>{suggestion.label}</span>
    </button>
  );
}

export function ChatMessages({
  messages,
  status,
  currentOrigin,
  onSuggestion,
  layout = "page",
  hasOlderMessages = false,
  loadingOlder = false,
  onLoadOlder,
  emptyStateTitle = "Hoe kan ik je helpen?",
  emptyStateDescription = "Zoek vacatures, beheer kandidaten, analyseer data of upload een CV.",
  emptyStatePrompts = DEFAULT_EMPTY_STATE_PROMPTS,
  followUpPrompts = [],
  conversationLabel = "Chatgesprek met Motian AI",
}: Props) {
  const hasUserMessage = messages.some((message) => message.role === "user");
  const isWidget = layout === "widget";
  const showFollowUpPrompts = hasUserMessage && status === "ready" && followUpPrompts.length > 0;

  return (
    <Conversation className="flex-1" aria-label={conversationLabel}>
      <ConversationContent
        className={cn(
          "mx-auto flex w-full gap-4",
          isWidget
            ? "max-w-3xl px-3 py-4 pb-28 sm:px-4 sm:pb-32"
            : "max-w-4xl px-3 py-4 pb-32 sm:px-4 sm:py-6 sm:pb-40",
          !hasUserMessage &&
            (isWidget
              ? "flex min-h-full flex-col justify-center"
              : "flex min-h-[calc(100vh-160px)] flex-col justify-center"),
        )}
      >
        {hasOlderMessages || loadingOlder ? (
          <div className="flex justify-center pb-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onLoadOlder}
              disabled={loadingOlder}
              className="rounded-full"
              aria-label="Laad oudere berichten"
            >
              {loadingOlder ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
              Oudere berichten laden
            </Button>
          </div>
        ) : null}

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

                  return (
                    <MessageResponse
                      key={partKey}
                      allowedTags={CHAT_MESSAGE_ALLOWED_TAGS}
                      components={CHAT_MESSAGE_COMPONENTS}
                    >
                      {rewriteChatJobLinks(part.text, currentOrigin)}
                    </MessageResponse>
                  );
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
                  const entry = name ? GENUI_REGISTRY[name] : undefined;
                  const isErrorOutput =
                    toolPart.output &&
                    typeof toolPart.output === "object" &&
                    "error" in toolPart.output;

                  if (toolPart.state === "output-error") {
                    const messageText =
                      toolPart.output &&
                      typeof toolPart.output === "object" &&
                      "error" in toolPart.output &&
                      typeof (toolPart.output as { error: unknown }).error === "string"
                        ? (toolPart.output as { error: string }).error
                        : "Er is iets misgegaan bij deze actie.";
                    return <ToolErrorBlock key={partKey} message={messageText} />;
                  }

                  if (
                    toolPart.state === "output-available" &&
                    entry &&
                    toolPart.output !== undefined
                  ) {
                    if (isErrorOutput) {
                      const messageText =
                        typeof (toolPart.output as { error: unknown }).error === "string"
                          ? (toolPart.output as { error: string }).error
                          : "Niet gevonden.";
                      return <ToolErrorBlock key={partKey} message={messageText} />;
                    }

                    const GenUICard = entry.component;
                    return (
                      <Suspense
                        key={partKey}
                        fallback={<GenUILoadingSkeleton label={entry.label} />}
                      >
                        <GenUICard output={toolPart.output} />
                      </Suspense>
                    );
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

        {showFollowUpPrompts ? (
          <section className="mt-2 flex flex-col gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-3 sm:p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Vervolgideeën
            </div>
            <div className="flex flex-wrap gap-2">
              {followUpPrompts.map((suggestion) => (
                <FollowUpPromptButton
                  key={suggestion.label}
                  suggestion={suggestion}
                  onSelect={onSuggestion}
                />
              ))}
            </div>
          </section>
        ) : null}

        {(status === "streaming" || status === "submitted") &&
        messages.at(-1)?.role !== "assistant" ? (
          <div
            className="flex items-center gap-1.5 text-sm text-muted-foreground"
            aria-live="polite"
          >
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
            Denkt na...
          </div>
        ) : null}

        {!hasUserMessage ? (
          <section
            className={cn(
              "mx-auto flex w-full flex-1 items-center justify-center py-2 sm:py-6",
              isWidget ? "max-w-3xl" : "max-w-4xl",
            )}
          >
            <div
              className={cn(
                "w-full rounded-[28px] border border-border/70 bg-card/95 p-5 shadow-sm sm:p-8",
                isWidget && "rounded-3xl p-4 sm:p-5",
              )}
            >
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    Motian AI
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-2xl">
                      {emptyStateTitle}
                    </h2>
                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                      {emptyStateDescription}
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/80 px-3 py-2 text-xs leading-5 text-muted-foreground">
                  Enter om te verzenden
                  <br />
                  Shift+Enter voor een nieuwe regel
                </div>
              </div>

              <div
                className={cn(
                  "grid gap-3",
                  isWidget ? "grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-4",
                )}
              >
                {emptyStatePrompts.map((suggestion) => (
                  <SuggestedPromptCard
                    key={suggestion.label}
                    suggestion={suggestion}
                    onSelect={onSuggestion}
                  />
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
