"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Check, Loader2, MessageSquare, Paperclip, RotateCcw, X } from "lucide-react";
import { nanoid } from "nanoid";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  PromptInput,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/src/components/ai-elements/prompt-input";
import { useChatContext } from "./chat-context-provider";
import { ChatMessages } from "./chat-messages";

const SESSION_KEY = "motian-fab-session";

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const id = nanoid();
  sessionStorage.setItem(SESSION_KEY, id);
  return id;
}

type UploadState = "idle" | "uploading" | "success" | "error";

function ChatPanelInner({
  ctx,
  sessionId,
}: {
  ctx: { route: string; entityId: string | null; entityType: string | null };
  sessionId: string;
}) {
  const { messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: {
        context: {
          route: ctx.route,
          entityId: ctx.entityId,
          entityType: ctx.entityType,
          sessionId,
        },
      },
    }),
  });

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
    <>
      <ChatMessages
        messages={messages}
        status={status}
        onSuggestion={(text) => sendMessage({ text })}
      />

      {/* Upload status */}
      {uploadState !== "idle" && (
        <div
          className={`flex items-center gap-2 border-t px-3 py-1.5 text-xs ${
            uploadState === "error"
              ? "border-destructive/20 bg-destructive/5 text-destructive"
              : uploadState === "success"
                ? "border-primary/20 bg-primary/5 text-primary"
                : "border-border bg-muted/50 text-muted-foreground"
          }`}
        >
          {uploadState === "uploading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {uploadState === "success" && <Check className="h-3.5 w-3.5" />}
          {uploadState === "error" && <X className="h-3.5 w-3.5" />}
          <span className="truncate">{uploadResult ?? "Verwerken..."}</span>
        </div>
      )}

      <div className="border-t border-border p-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={handleFileChange}
        />
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea placeholder="Stel een vraag of upload een CV..." />
          <PromptInputFooter>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadState === "uploading"}
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              title="CV/document uploaden"
            >
              <Paperclip className="h-3.5 w-3.5" />
            </button>
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </>
  );
}

export function ChatPanel() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState(getOrCreateSessionId);
  const ctx = useChatContext();

  const handleNewSession = useCallback(() => {
    const id = nanoid();
    sessionStorage.setItem(SESSION_KEY, id);
    setSessionId(id);
  }, []);

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

  if (pathname === "/chat") return null;

  return (
    <>
      {/* FAB button */}
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
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleNewSession}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Nieuw gesprek"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Sluiten (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Chat content — key forces remount on session change */}
        <ChatPanelInner key={sessionId} ctx={ctx} sessionId={sessionId} />
      </div>
    </>
  );
}
