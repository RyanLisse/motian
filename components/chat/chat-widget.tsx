"use client";

import { Loader2, Maximize2, MessageSquare, Paperclip, RotateCcw, X } from "lucide-react";
import { nanoid } from "nanoid";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  PromptInput,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/src/components/ai-elements/prompt-input";
import {
  ChatCvDropOverlay,
  ChatCvUploadStatusBanner,
  useChatCvUpload,
} from "@/src/components/ai-elements/use-chat-cv-upload";
import { CV_UPLOAD_ACCEPT, CV_UPLOAD_MAX_SIZE_BYTES } from "@/src/lib/cv-upload";
import { useChatContext } from "./chat-context-provider";
import { ChatMessages } from "./chat-messages";
import { useChatThread } from "./use-chat-thread";

const SESSION_KEY = "motian-fab-session";
const FULL_PAGE_SESSION_KEY = "motian-chat-session";
const CHAT_WIDGET_OPEN_EVENT = "motian-chat-open";

function isStorageAvailable(): boolean {
  try {
    if (typeof window === "undefined" || window.sessionStorage == null) return false;
    const key = "__motian_storage_test__";
    window.sessionStorage.setItem(key, "1");
    window.sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function persistSessionId(key: string, value: string) {
  if (!isStorageAvailable()) return;

  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Ignore storage failures in private / embedded contexts.
  }
}

function getOrCreateSessionId(): string {
  try {
    if (!isStorageAvailable()) return nanoid();
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;

    const id = nanoid();
    window.sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return nanoid();
  }
}

function ChatWidgetSurface({
  currentOrigin,
  hasMoreHistory,
  loadingOlder,
  messages,
  onLoadOlder,
  onSuggestion,
  sendMessage,
  status,
  stop,
}: {
  currentOrigin?: string | null;
  hasMoreHistory: boolean;
  loadingOlder: boolean;
  messages: Parameters<typeof ChatMessages>[0]["messages"];
  onLoadOlder: () => void;
  onSuggestion: (text: string) => void;
  sendMessage: (message: { text: string }) => void;
  status: Parameters<typeof ChatMessages>[0]["status"];
  stop: () => void;
}) {
  const cvUpload = useChatCvUpload({ onSendMessage: sendMessage });

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      const text = message.text.trim();
      if (!text) {
        return;
      }
      sendMessage({ text });
    },
    [sendMessage],
  );

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <ChatCvDropOverlay active={cvUpload.isDraggingFile} variant="widget" />

      <ChatMessages
        layout="widget"
        messages={messages}
        status={status}
        currentOrigin={currentOrigin}
        onSuggestion={onSuggestion}
        hasOlderMessages={hasMoreHistory}
        loadingOlder={loadingOlder}
        onLoadOlder={onLoadOlder}
      />

      <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-3 sm:pb-4">
        <div className="flex flex-col gap-1.5 overflow-hidden rounded-xl border border-border bg-background shadow-lg">
          <ChatCvUploadStatusBanner
            clearFeedback={cvUpload.clearFeedback}
            uploadFileName={cvUpload.uploadFileName}
            uploadMessage={cvUpload.uploadMessage}
            uploadState={cvUpload.uploadState}
            variant="widget"
          />

          <div className="p-2">
            <PromptInput
              accept={CV_UPLOAD_ACCEPT}
              globalDrop
              maxFileSize={CV_UPLOAD_MAX_SIZE_BYTES}
              maxFiles={1}
              onError={cvUpload.handlePromptInputError}
              onSubmit={handleSubmit}
            >
              <PromptInputTextarea placeholder="Stel een vraag of upload een CV..." />
              <PromptInputFooter>
                <button
                  type="button"
                  onClick={cvUpload.openFileDialog}
                  disabled={cvUpload.uploadState === "uploading"}
                  aria-label="CV of document uploaden"
                  className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                  title="CV/document uploaden"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                </button>
                <PromptInputSubmit
                  status={status}
                  onStop={stop}
                  aria-label={
                    status === "submitted" || status === "streaming"
                      ? "Stop antwoord"
                      : "Verstuur bericht"
                  }
                />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatWidgetInner({
  ctx,
  sessionId,
  currentOrigin,
}: {
  ctx: { route: string; entityId: string | null; entityType: "opdracht" | "kandidaat" | null };
  sessionId: string;
  currentOrigin?: string | null;
}) {
  const { messages, sendMessage, status, stop, hasMoreHistory, loadingOlder, loadOlder } =
    useChatThread({
      sessionId,
      context: ctx,
    });

  const handleSuggestion = useCallback(
    (text: string) => {
      sendMessage({ text });
    },
    [sendMessage],
  );

  const handleLoadOlder = useCallback(() => {
    void loadOlder();
  }, [loadOlder]);

  return (
    <PromptInputProvider>
      <ChatWidgetSurface
        currentOrigin={currentOrigin}
        hasMoreHistory={hasMoreHistory}
        loadingOlder={loadingOlder}
        messages={messages}
        onLoadOlder={handleLoadOlder}
        onSuggestion={handleSuggestion}
        sendMessage={sendMessage}
        status={status}
        stop={stop}
      />
    </PromptInputProvider>
  );
}

export function ChatWidget({ currentOrigin = null }: { currentOrigin?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { activeContext, prepareFullPageHandoff } = useChatContext();
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSessionId(getOrCreateSessionId());
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  const handleNewSession = useCallback(() => {
    const id = nanoid();
    persistSessionId(SESSION_KEY, id);
    setSessionId(id);
  }, []);

  const handleExpandToPage = useCallback(() => {
    const handoffSessionId = sessionId || getOrCreateSessionId();
    persistSessionId(FULL_PAGE_SESSION_KEY, handoffSessionId);
    prepareFullPageHandoff();
    router.push("/chat");
  }, [prepareFullPageHandoff, router, sessionId]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        setOpen((previous) => !previous);
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

  useEffect(() => {
    const handleOpen = () => setOpen(true);

    window.addEventListener(CHAT_WIDGET_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(CHAT_WIDGET_OPEN_EVENT, handleOpen);
  }, []);

  if (pathname === "/chat" || pathname === "/opdrachten") return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open chatwidget"
          className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
          title="Open chatwidget (⌘J)"
        >
          <MessageSquare className="h-5 w-5" />
        </button>
      )}

      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] sm:hidden"
          onClick={() => setOpen(false)}
          aria-label="Sluit chat-widget"
        />
      )}

      <div
        className={cn(
          "fixed inset-x-3 bottom-3 top-16 z-50 flex origin-bottom-right flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl transition-all duration-200 ease-out sm:inset-x-auto sm:right-6 sm:top-auto sm:h-[min(720px,calc(100vh-6rem))] sm:w-[420px]",
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-4 scale-95 opacity-0",
        )}
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Motian AI</span>
              {activeContext.entityId ? (
                <span className="rounded-full border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[10px] text-foreground">
                  {activeContext.entityType}
                </span>
              ) : null}
            </div>
            {activeContext.route !== "/chat" ? (
              <p className="truncate text-[11px] text-muted-foreground">
                Context: {activeContext.route}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleNewSession}
              aria-label="Nieuw gesprek"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Nieuw gesprek"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleExpandToPage}
              aria-label="Open volledige chat"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Open volledige chat"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Sluit chatwidget"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Sluiten (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {open ? (
          sessionId ? (
            <ChatWidgetInner
              key={sessionId}
              ctx={activeContext}
              sessionId={sessionId}
              currentOrigin={currentOrigin}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )
        ) : null}
      </div>
    </>
  );
}
