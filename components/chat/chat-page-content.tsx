"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import {
  Check,
  ChevronDown,
  Loader2,
  Menu,
  Mic,
  PanelLeftClose,
  Paperclip,
  Plus,
  X,
} from "lucide-react";
import { nanoid } from "nanoid";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  PromptInput,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/src/components/ai-elements/prompt-input";
import { useChatContext } from "./chat-context-provider";
import { ChatHistorySidebar } from "./chat-history-sidebar";
import { ChatMessages } from "./chat-messages";
import { VoiceSession } from "./voice-session";

const CHAT_MODELS = [
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite", provider: "Google" },
  { id: "gemini-3-flash", label: "Gemini 3 Flash", provider: "Google" },
  { id: "gpt-5-nano", label: "GPT-5 Nano", provider: "OpenAI" },
  { id: "grok-4", label: "Grok 4", provider: "xAI" },
] as const;

type UploadState = "idle" | "uploading" | "success" | "error";

function ChatSession({
  sessionId,
  initialMessages,
  ctx,
  modelId,
}: {
  sessionId: string;
  initialMessages?: UIMessage[];
  ctx: { route: string; entityId: string | null; entityType: string | null };
  modelId: string;
}) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: {
          model: modelId,
          context: {
            route: ctx.route,
            entityId: ctx.entityId,
            entityType: ctx.entityType,
            sessionId,
          },
        },
      }),
    [modelId, ctx.route, ctx.entityId, ctx.entityType, sessionId],
  );

  const { messages, sendMessage, status, stop } = useChat({
    messages: initialMessages,
    transport,
  });

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
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
        setUploadResult("Alleen PDF en Word (.docx) bestanden");
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        setUploadState("error");
        setUploadResult("Bestand te groot (max 20MB)");
        return;
      }

      setUploadState("uploading");
      setUploadFileName(file.name);
      setUploadResult(null);

      try {
        // Step 1: Upload and parse CV
        const formData = new FormData();
        formData.append("cv", file);
        const uploadRes = await fetch("/api/cv-upload", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) {
          const json = await uploadRes.json();
          throw new Error(json.error ?? "Upload mislukt");
        }
        const { parsed, fileUrl, duplicates } = await uploadRes.json();

        // Step 2: Auto-save candidate to talent pool
        const saveRes = await fetch("/api/cv-upload/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parsed,
            fileUrl,
            existingCandidateId: duplicates?.exact?.id,
          }),
        });
        if (!saveRes.ok) throw new Error("Opslaan mislukt");
        const saveData = await saveRes.json();

        setUploadState("success");
        const action = duplicates?.exact ? "bijgewerkt" : "toegevoegd aan talentpool";
        setUploadResult(`${parsed.name} ${action}`);

        // Step 3: Send a message to the chat about the uploaded CV
        const skillsList = [
          ...parsed.skills.hard.map((s: { name: string }) => s.name),
          ...parsed.skills.soft.map((s: { name: string }) => s.name),
        ]
          .slice(0, 8)
          .join(", ");

        sendMessage({
          text: `Ik heb zojuist een CV geüpload voor ${parsed.name} (${parsed.role}). Het profiel is automatisch ${action}. Vaardigheden: ${skillsList}. Kandidaat ID: ${saveData.candidateId}. Geef een samenvatting van dit profiel en zoek passende vacatures.`,
        });

        // Auto-dismiss after 4 seconds
        setTimeout(() => {
          setUploadState("idle");
          setUploadFileName(null);
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
        messages={messages}
        status={status}
        onSuggestion={(text) => sendMessage({ text })}
      />

      {/* Floating Chat Input Container */}
      <div className="absolute inset-x-0 bottom-0 z-10 mx-auto w-full max-w-3xl px-4 pb-4 sm:pb-6">
        <div className="flex flex-col gap-2 rounded-3xl border border-border/50 bg-muted/30 shadow-sm focus-within:ring-1 focus-within:ring-ring/40 transition-shadow">
          {/* Upload status banner */}
          {uploadState !== "idle" && (
            <div
              className={`flex items-center gap-2 px-4 py-2.5 text-sm ${
                uploadState === "error"
                  ? "bg-destructive/5 text-destructive"
                  : uploadState === "success"
                    ? "bg-primary/5 text-primary"
                    : "bg-muted/50 text-muted-foreground"
              }`}
            >
              {uploadState === "uploading" && (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  <span className="truncate">
                    <span className="font-medium">{uploadFileName}</span> — CV wordt verwerkt &
                    kandidaat wordt aangemaakt...
                  </span>
                </>
              )}
              {uploadState === "success" && (
                <>
                  <Check className="h-4 w-4 shrink-0" />
                  <span className="truncate">{uploadResult}</span>
                </>
              )}
              {uploadState === "error" && (
                <>
                  <X className="h-4 w-4 shrink-0" />
                  <span className="truncate">{uploadResult}</span>
                  <button
                    type="button"
                    onClick={() => setUploadState("idle")}
                    className="ml-auto shrink-0 rounded p-0.5 hover:bg-destructive/10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </>
              )}
            </div>
          )}

          {/* Chat input with file upload */}
          <div className="p-2 sm:p-3">
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
                  className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                  title="CV/document uploaden (PDF, Word)"
                >
                  <Paperclip className="h-4 w-4" />
                  <span className="hidden sm:inline">Document</span>
                </button>
                <PromptInputSubmit status={status} onStop={stop} />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChatPageContent() {
  const ctx = useChatContext();
  const [sessionId, setSessionId] = useState(() => nanoid());
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | undefined>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modelId, setModelId] = useState<string>(CHAT_MODELS[0].id);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [mode, setMode] = useState<"text" | "voice">("text");

  const handleSelectSession = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/chat-sessies/${id}`);
      if (res.ok) {
        const session = await res.json();
        setInitialMessages(session.messages ?? []);
        setSessionId(id);
      }
    } catch {
      setInitialMessages(undefined);
      setSessionId(id);
    }
    // Close sidebar on mobile after selection
    setSidebarOpen(false);
  }, []);

  const handleNewSession = useCallback(() => {
    setInitialMessages(undefined);
    setSessionId(nanoid());
    setSidebarOpen(false);
  }, []);

  return (
    <div className="relative flex h-[calc(100vh-var(--sidebar-height,0px))]">
      {/* Backdrop overlay for mobile sidebar */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Sluit zijbalk"
        />
      )}

      {/* History sidebar — overlay on mobile, inline on desktop */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-[280px] transform transition-transform duration-200 ease-in-out lg:relative lg:z-auto ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:-translate-x-full"
        }`}
      >
        <ChatHistorySidebar
          activeSessionId={sessionId}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSession}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Main chat area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3 sm:px-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Gesprekken"
            >
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>

            {/* Model picker */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setModelPickerOpen((p) => !p)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                {CHAT_MODELS.find((m) => m.id === modelId)?.label ?? "Model"}
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>
              {modelPickerOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-50"
                    onClick={() => setModelPickerOpen(false)}
                    aria-label="Sluit"
                  />
                  <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-lg border border-border bg-popover py-1 shadow-lg">
                    {CHAT_MODELS.map((m) => (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => {
                          setModelId(m.id);
                          setModelPickerOpen(false);
                        }}
                        className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent ${
                          modelId === m.id ? "text-primary" : "text-foreground"
                        }`}
                      >
                        <span className="font-medium">{m.label}</span>
                        <span className="text-[10px] text-muted-foreground">{m.provider}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Voice mode toggle */}
            <button
              type="button"
              onClick={() => setMode((m) => (m === "text" ? "voice" : "text"))}
              className={`rounded-md p-1.5 transition-colors ${
                mode === "voice"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
              title={mode === "voice" ? "Terug naar tekst" : "Spraakassistent"}
            >
              <Mic className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={handleNewSession}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Nieuw gesprek"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Nieuw gesprek</span>
            </button>
          </div>
        </header>

        {/* Voice or text mode */}
        {mode === "voice" ? (
          <VoiceSession onClose={() => setMode("text")} />
        ) : (
          <ChatSession
            key={`${sessionId}-${modelId}`}
            sessionId={sessionId}
            initialMessages={initialMessages}
            ctx={ctx}
            modelId={modelId}
          />
        )}
      </div>
    </div>
  );
}
