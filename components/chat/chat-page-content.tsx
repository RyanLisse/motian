"use client";

import {
  ArrowUp,
  ArrowUpRight,
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
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
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
import {
  CHAT_MODELS,
  type ChatSpeedMode,
  MODE_OPTIONS,
  useChatContext,
} from "./chat-context-provider";
import { ChatHistorySidebar } from "./chat-history-sidebar";
import { ChatMessages } from "./chat-messages";
import { VoiceSession } from "./voice-session";

type UploadState = "idle" | "uploading" | "success" | "error";

function getContextLabel(ctx: {
  route: string;
  entityId: string | null;
  entityType: string | null;
}) {
  if (ctx.entityType === "opdracht") return "Verder vanuit opdracht";
  if (ctx.entityType === "kandidaat") return "Verder vanuit kandidaat";
  if (ctx.route !== "/chat") return `Verder vanuit ${ctx.route}`;
  return "Algemene chat";
}

function ChatSession({ onToggleVoice }: { onToggleVoice: () => void }) {
  const { messages, modelId, sendMessage, setModelId, setSpeedMode, speedMode, status, stop } =
    useChatContext();

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
        layout="page"
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
                  aria-label="Sluit uploadmelding"
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
                  <PromptInputActionMenuTrigger
                    tooltip="Bijlage toevoegen"
                    aria-label="Bijlage toevoegen"
                  />
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
                  onValueChange={(value) => setSpeedMode(value as ChatSpeedMode)}
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
                <PromptInputButton
                  tooltip="Spraakassistent"
                  aria-label="Open spraakassistent"
                  onClick={onToggleVoice}
                >
                  <Mic className="h-4 w-4" />
                </PromptInputButton>
                <PromptInputSubmit
                  status={status}
                  onStop={stop}
                  aria-label={
                    status === "submitted" || status === "streaming"
                      ? "Stop antwoord"
                      : "Verstuur bericht"
                  }
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
  const {
    activeContext,
    loadSession,
    mode,
    sessionId,
    sessionLoadError,
    setMode,
    startNewSession,
  } = useChatContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const hasSourceContext = activeContext.route !== "/chat";

  const handleSelectSession = useCallback(
    async (id: string) => {
      try {
        await loadSession(id);
        setSidebarOpen(false);
      } catch {
        // Keep the current conversation visible and leave the sidebar open so the user
        // can retry or choose a different session.
      }
    },
    [loadSession],
  );

  const handleNewSession = useCallback(() => {
    startNewSession();
    setSidebarOpen(false);
  }, [startNewSession]);

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
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              aria-label={sidebarOpen ? "Sluit gesprekken" : "Open gesprekken"}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title={sidebarOpen ? "Sluit gesprekken" : "Open gesprekken"}
            >
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>

            <div className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  "hidden max-w-[260px] truncate rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground md:inline-flex",
                  hasSourceContext && "border-primary/20 bg-primary/5 text-foreground",
                )}
              >
                {getContextLabel(activeContext)}
              </span>

              {hasSourceContext ? (
                <Link
                  href={activeContext.route}
                  className="hidden items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:inline-flex"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  Bronpagina
                </Link>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={handleNewSession}
            aria-label="Nieuw gesprek"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Nieuw gesprek"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Nieuw gesprek</span>
          </button>
        </header>

        {sessionLoadError ? (
          <div
            role="alert"
            className="border-b border-destructive/20 bg-destructive/5 px-4 py-2 text-sm text-destructive"
          >
            {sessionLoadError}
          </div>
        ) : null}

        {mode === "voice" ? (
          <VoiceSession onClose={() => setMode("text")} />
        ) : (
          <ChatSession
            key={sessionId || "chat-page-session"}
            onToggleVoice={() => setMode("voice")}
          />
        )}
      </div>
    </div>
  );
}
