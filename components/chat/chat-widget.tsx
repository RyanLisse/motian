"use client";

import { Check, Loader2, Maximize2, MessageSquare, Paperclip, RotateCcw, X } from "lucide-react";
import { nanoid } from "nanoid";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  PromptInput,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/src/components/ai-elements/prompt-input";
import { useChatContext } from "./chat-context-provider";
import { ChatMessages } from "./chat-messages";
import { useChatThread } from "./use-chat-thread";

const SESSION_KEY = "motian-fab-session";
const FULL_PAGE_SESSION_KEY = "motian-chat-session";
const CHAT_WIDGET_OPEN_EVENT = "motian-chat-open";

type UploadState = "idle" | "uploading" | "success" | "error";

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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadResult, setUploadResult] = useState<string | null>(null);

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      const text = message.text.trim();
      if (!text) return;
      sendMessage({ text });
    },
    [sendMessage],
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      const validTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      if (!validTypes.includes(file.type)) {
        setUploadState("error");
        setUploadResult("Alleen PDF en Word (.docx)");
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        setUploadState("error");
        setUploadResult("Max 20MB");
        return;
      }

      setUploadState("uploading");
      setUploadResult(null);

      try {
        const formData = new FormData();
        formData.append("cv", file);
        const uploadRes = await fetch("/api/cv-upload", { method: "POST", body: formData });
        if (!uploadRes.ok) {
          const json = await uploadRes.json();
          throw new Error(json.error ?? "Upload mislukt");
        }
        const { parsed, fileUrl, duplicates } = await uploadRes.json();

        const saveRes = await fetch("/api/cv-upload/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parsed, fileUrl, existingCandidateId: duplicates?.exact?.id }),
        });
        if (!saveRes.ok) throw new Error("Opslaan mislukt");
        const saveData = await saveRes.json();

        const action = duplicates?.exact ? "bijgewerkt" : "toegevoegd aan talentpool";
        setUploadState("success");
        setUploadResult(`${parsed.name} ${action}`);

        const skillsList = [
          ...parsed.skills.hard.map((s: { name: string }) => s.name),
          ...parsed.skills.soft.map((s: { name: string }) => s.name),
        ]
          .slice(0, 8)
          .join(", ");

        sendMessage({
          text: `CV geüpload: ${parsed.name} (${parsed.role}), ${action}. Vaardigheden: ${skillsList}. ID: ${saveData.candidateId}. Geef samenvatting en zoek vacatures.`,
        });

        setTimeout(() => {
          setUploadState("idle");
          setUploadResult(null);
        }, 4000);
      } catch (err) {
        setUploadState("error");
        setUploadResult(err instanceof Error ? err.message : "Upload mislukt");
      }
    },
    [sendMessage],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileUpload(file);
      e.target.value = "";
    },
    [handleFileUpload],
  );

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <ChatMessages
        layout="widget"
        messages={messages}
        status={status}
        currentOrigin={currentOrigin}
        onSuggestion={handleSuggestion}
        hasOlderMessages={hasMoreHistory}
        loadingOlder={loadingOlder}
        onLoadOlder={handleLoadOlder}
      />

      <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-3 sm:pb-4">
        <div className="flex flex-col gap-1.5 overflow-hidden rounded-xl border border-border bg-background shadow-lg">
          {uploadState !== "idle" && (
            <div
              className={`flex items-center gap-2 px-3 py-2 text-xs ${
                uploadState === "error"
                  ? "bg-destructive/5 text-destructive"
                  : uploadState === "success"
                    ? "bg-primary/5 text-primary"
                    : "bg-muted/50 text-muted-foreground"
              }`}
            >
              {uploadState === "uploading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {uploadState === "success" && <Check className="h-3.5 w-3.5" />}
              {uploadState === "error" && <X className="h-3.5 w-3.5" />}
              <span className="truncate">{uploadResult ?? "Verwerken..."}</span>
            </div>
          )}

          <div className="p-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={handleFileChange}
            />
            <PromptInput allowAttachments={false} onSubmit={handleSubmit}>
              <PromptInputTextarea
                allowAttachments={false}
                placeholder="Stel een vraag of upload een CV..."
              />
              <PromptInputFooter>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadState === "uploading"}
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

        {sessionId ? (
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
        )}
      </div>
    </>
  );
}
