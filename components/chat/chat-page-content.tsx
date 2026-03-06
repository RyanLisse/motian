"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import {
  ArrowUp,
  Check,
  Gauge,
  Loader2,
  Menu,
  Mic,
  PanelLeftClose,
  Plus,
  Square,
  X,
  Zap,
} from "lucide-react";
import { nanoid } from "nanoid";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuItem,
  PromptInputActionMenuTrigger,
  PromptInputButton,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
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

const MODE_OPTIONS = [
  { id: "snel", label: "Snel", icon: Zap },
  { id: "gemiddeld", label: "Gemiddeld", icon: Gauge },
  { id: "grondig", label: "Grondig", icon: Gauge },
] as const;

type SpeedMode = (typeof MODE_OPTIONS)[number]["id"];
type UploadState = "idle" | "uploading" | "success" | "error";

function ChatSession({
  sessionId,
  initialMessages,
  ctx,
  modelId,
  setModelId,
  onToggleVoice,
}: {
  sessionId: string;
  initialMessages?: UIMessage[];
  ctx: { route: string; entityId: string | null; entityType: string | null };
  modelId: string;
  setModelId: (id: string) => void;
  onToggleVoice: () => void;
}) {
  const [speedMode, setSpeedMode] = useState<SpeedMode>("gemiddeld");

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: {
          model: modelId,
          speedMode,
          context: {
            route: ctx.route,
            entityId: ctx.entityId,
            entityType: ctx.entityType,
            sessionId,
          },
        },
      }),
    [modelId, speedMode, ctx.route, ctx.entityId, ctx.entityType, sessionId],
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
        {/* Upload status banner */}
        {uploadState !== "idle" && (
          <div
            className={`mb-2 flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm ${
              uploadState === "error"
                ? "bg-destructive/10 text-destructive"
                : uploadState === "success"
                  ? "bg-primary/10 text-primary"
                  : "bg-muted/60 text-muted-foreground"
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

        {/* Hidden file input for CV upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="rounded-3xl border border-border/50 bg-muted/30 shadow-sm transition-shadow focus-within:ring-1 focus-within:ring-ring/40">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputTextarea placeholder="Vraag om vervolgwijzigingen" />
            <PromptInputFooter className="px-2 pb-2 pt-0">
              {/* Left side: + menu, model picker, mode picker */}
              <PromptInputTools>
                <PromptInputActionMenu>
                  <PromptInputActionMenuTrigger tooltip="Bijlage toevoegen" />
                  <PromptInputActionMenuContent>
                    <PromptInputActionAddAttachments label="Foto's of bestanden" />
                    <PromptInputActionMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }}
                    >
                      CV uploaden (PDF, Word)
                    </PromptInputActionMenuItem>
                  </PromptInputActionMenuContent>
                </PromptInputActionMenu>

                <PromptInputSelect value={modelId} onValueChange={setModelId}>
                  <PromptInputSelectTrigger className="h-8 w-auto gap-1 px-2 text-xs">
                    <Zap className="h-3.5 w-3.5" />
                    <PromptInputSelectValue />
                  </PromptInputSelectTrigger>
                  <PromptInputSelectContent>
                    {CHAT_MODELS.map((m) => (
                      <PromptInputSelectItem key={m.id} value={m.id}>
                        <span>{m.label}</span>
                        <span className="ml-2 text-[10px] text-muted-foreground">{m.provider}</span>
                      </PromptInputSelectItem>
                    ))}
                  </PromptInputSelectContent>
                </PromptInputSelect>

                <PromptInputSelect
                  value={speedMode}
                  onValueChange={(v) => setSpeedMode(v as SpeedMode)}
                >
                  <PromptInputSelectTrigger className="h-8 w-auto gap-1 px-2 text-xs">
                    <Gauge className="h-3.5 w-3.5" />
                    <PromptInputSelectValue />
                  </PromptInputSelectTrigger>
                  <PromptInputSelectContent>
                    {MODE_OPTIONS.map((m) => (
                      <PromptInputSelectItem key={m.id} value={m.id}>
                        {m.label}
                      </PromptInputSelectItem>
                    ))}
                  </PromptInputSelectContent>
                </PromptInputSelect>
              </PromptInputTools>

              {/* Right side: mic button, send button */}
              <PromptInputTools>
                <PromptInputButton tooltip="Spraakassistent" onClick={onToggleVoice}>
                  <Mic className="h-4 w-4" />
                </PromptInputButton>
                <PromptInputSubmit
                  status={status}
                  onStop={stop}
                  className="rounded-full"
                  variant="default"
                  size="icon-sm"
                >
                  {status === "submitted" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : status === "streaming" ? (
                    <Square className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </PromptInputSubmit>
              </PromptInputTools>
            </PromptInputFooter>
          </PromptInput>
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
        {/* Simplified header — sidebar toggle + new chat only */}
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3 sm:px-4">
          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Gesprekken"
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
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
            setModelId={setModelId}
            onToggleVoice={() => setMode("voice")}
          />
        )}
      </div>
    </div>
  );
}
