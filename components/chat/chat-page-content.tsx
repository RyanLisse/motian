"use client";

import {
  ArrowUp,
  ArrowUpRight,
  Brain,
  Briefcase,
  Check,
  FileText,
  Gauge,
  Loader2,
  Menu,
  Mic,
  PanelLeftClose,
  Plus,
  Search,
  Sparkles,
  Square,
  TrendingUp,
  Upload,
  Users,
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
import { ChatMessages, type ChatSuggestion } from "./chat-messages";
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

type ChatSurfaceConfig = {
  conversationLabel: string;
  emptyStateTitle: string;
  emptyStateDescription: string;
  composerPlaceholder: string;
  starterPrompts: ChatSuggestion[];
  followUpPrompts: ChatSuggestion[];
};

const GENERAL_STARTER_PROMPTS: ChatSuggestion[] = [
  {
    icon: Search,
    label: "Zoek vacatures",
    description: "Start met een concrete zoekopdracht op regio, skill of platform.",
    prompt: "Zoek Java vacatures in Utrecht met een uurtarief vanaf €90.",
    toneClassName: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  {
    icon: Users,
    label: "Maak een shortlist",
    description: "Vraag om kandidaten met de juiste vaardigheden of beschikbaarheid.",
    prompt: "Toon de 5 meest relevante kandidaten voor Java recruitment deze week.",
    toneClassName: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    icon: TrendingUp,
    label: "Analyseer de markt",
    description: "Laat Motian tarieven, volumes of platformverschillen samenvatten.",
    prompt: "Vat de huidige markttrends samen voor Java opdrachten in de Randstad.",
    toneClassName: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    icon: Upload,
    label: "Upload een CV",
    description: "Importeer een kandidaatprofiel en laat direct een eerste analyse maken.",
    prompt: "Hoe upload ik een CV en laat ik direct passende vacatures zoeken?",
    toneClassName: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
];

const JOB_STARTER_PROMPTS: ChatSuggestion[] = [
  {
    icon: Briefcase,
    label: "Vat deze opdracht samen",
    description: "Krijg een recruiter-vriendelijke samenvatting met de kernvereisten.",
    prompt: "Vat deze opdracht samen in 5 bullets voor een recruiter.",
    toneClassName: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  {
    icon: Users,
    label: "Zoek passende kandidaten",
    description: "Gebruik de huidige opdrachtcontext om sneller relevante matches te vinden.",
    prompt: "Welke kandidaten passen het best bij deze opdracht? Geef een top 5 met motivatie.",
    toneClassName: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    icon: Brain,
    label: "Signaleer risico’s",
    description: "Laat Motian gaten, blockers of vragen voor intake benoemen.",
    prompt: "Welke risico’s of onduidelijkheden zie je in deze opdrachtomschrijving?",
    toneClassName: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    icon: FileText,
    label: "Maak outreach notes",
    description: "Zet de opdracht om in heldere punten voor intake of kandidaatpitch.",
    prompt: "Maak een korte intakebriefing voor deze opdracht die ik met een kandidaat kan delen.",
    toneClassName: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  },
];

const CANDIDATE_STARTER_PROMPTS: ChatSuggestion[] = [
  {
    icon: Users,
    label: "Vat dit profiel samen",
    description: "Krijg direct een compact overzicht van ervaring, skills en opvallende punten.",
    prompt: "Vat dit kandidaatprofiel samen in 5 recruiter bullets.",
    toneClassName: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    icon: Briefcase,
    label: "Zoek passende opdrachten",
    description: "Gebruik het profiel als context om kansen of matches sneller te beoordelen.",
    prompt: "Welke opdrachten passen het best bij deze kandidaat? Geef een top 5 met motivatie.",
    toneClassName: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  {
    icon: Brain,
    label: "Benoem skill gaps",
    description: "Laat Motian risico’s, ontbrekende ervaring of ontwikkelpunten aanwijzen.",
    prompt: "Welke skill gaps of risico’s zie je in dit profiel voor senior opdrachten?",
    toneClassName: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    icon: FileText,
    label: "Schrijf een pitch",
    description: "Genereer een korte klantgerichte introductie op basis van dit profiel.",
    prompt: "Schrijf een korte pitch van deze kandidaat voor een potentiële klant.",
    toneClassName: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  },
];

const GENERAL_FOLLOW_UP_PROMPTS: ChatSuggestion[] = [
  {
    icon: Sparkles,
    label: "Vat het kort samen",
    description: "",
    prompt: "Vat dit kort samen in 3 punten.",
    toneClassName: "bg-primary/10 text-primary",
  },
  {
    icon: TrendingUp,
    label: "Toon prioriteiten",
    description: "",
    prompt: "Welke acties zou jij als recruiter nu prioriteren?",
    toneClassName: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    icon: Search,
    label: "Ga een stap dieper",
    description: "",
    prompt: "Ga een stap dieper en geef concrete vervolgstappen.",
    toneClassName: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
];

const JOB_FOLLOW_UP_PROMPTS: ChatSuggestion[] = [
  {
    icon: Users,
    label: "Rank de beste matches",
    description: "",
    prompt: "Rank de beste matches voor deze opdracht en leg per kandidaat uit waarom.",
    toneClassName: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    icon: FileText,
    label: "Maak screeningvragen",
    description: "",
    prompt: "Schrijf 5 screeningvragen voor kandidaten op deze opdracht.",
    toneClassName: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  },
  {
    icon: Brain,
    label: "Benoem blockers",
    description: "",
    prompt: "Welke blockers of verduidelijkingen moet ik ophalen voordat ik kandidaten voorstel?",
    toneClassName: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
];

const CANDIDATE_FOLLOW_UP_PROMPTS: ChatSuggestion[] = [
  {
    icon: Briefcase,
    label: "Zoek de beste opdrachten",
    description: "",
    prompt: "Zoek de beste opdrachten voor deze kandidaat en motiveer de top 3.",
    toneClassName: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  {
    icon: FileText,
    label: "Maak een klantpitch",
    description: "",
    prompt: "Maak een korte klantpitch voor deze kandidaat met focus op impact en ervaring.",
    toneClassName: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  },
  {
    icon: Brain,
    label: "Check risico’s",
    description: "",
    prompt:
      "Welke risico’s of aandachtspunten moet ik meenemen bij het voorstellen van deze kandidaat?",
    toneClassName: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
];

function getChatSurfaceConfig(ctx: {
  route: string;
  entityId: string | null;
  entityType: string | null;
}): ChatSurfaceConfig {
  switch (ctx.entityType) {
    case "opdracht":
      return {
        conversationLabel: "Chatgesprek in opdrachtcontext",
        emptyStateTitle: "Wat wil je weten over deze opdracht?",
        emptyStateDescription:
          "De huidige opdrachtcontext wordt automatisch meegenomen. Vraag om een samenvatting, matchanalyse of recruiter-ready vervolgactie.",
        composerPlaceholder:
          "Vraag om een samenvatting, matchanalyse of outreach voor deze opdracht",
        starterPrompts: JOB_STARTER_PROMPTS,
        followUpPrompts: JOB_FOLLOW_UP_PROMPTS,
      };
    case "kandidaat":
      return {
        conversationLabel: "Chatgesprek in kandidaatcontext",
        emptyStateTitle: "Wat wil je uit dit profiel halen?",
        emptyStateDescription:
          "De huidige kandidaatcontext wordt automatisch meegenomen. Vraag om een profielsamenvatting, risicocheck of passende opdrachten.",
        composerPlaceholder:
          "Vraag om een profielsamenvatting, pitch of matchsuggestie voor deze kandidaat",
        starterPrompts: CANDIDATE_STARTER_PROMPTS,
        followUpPrompts: CANDIDATE_FOLLOW_UP_PROMPTS,
      };
    default:
      return {
        conversationLabel: "Chatgesprek met Motian AI",
        emptyStateTitle: "Waar wil je vandaag op sturen?",
        emptyStateDescription:
          "Start met een concrete vraag of kies een starter hieronder om vacatures, kandidaten of marktdynamiek sneller te analyseren.",
        composerPlaceholder: "Vraag om vacatures, kandidaten, analyses of hulp bij een CV-upload",
        starterPrompts: GENERAL_STARTER_PROMPTS,
        followUpPrompts: GENERAL_FOLLOW_UP_PROMPTS,
      };
  }
}

function ChatSession({
  onToggleVoice,
  surfaceConfig,
  currentOrigin,
}: {
  onToggleVoice: () => void;
  surfaceConfig: ChatSurfaceConfig;
  currentOrigin?: string | null;
}) {
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
        currentOrigin={currentOrigin}
        onSuggestion={(text) => sendMessage({ text })}
        emptyStateTitle={surfaceConfig.emptyStateTitle}
        emptyStateDescription={surfaceConfig.emptyStateDescription}
        emptyStatePrompts={surfaceConfig.starterPrompts}
        followUpPrompts={surfaceConfig.followUpPrompts}
        conversationLabel={surfaceConfig.conversationLabel}
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
            <PromptInputTextarea placeholder={surfaceConfig.composerPlaceholder} />
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

export function ChatPageContent({ currentOrigin = null }: { currentOrigin?: string | null }) {
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
  const surfaceConfig = getChatSurfaceConfig(activeContext);

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
            currentOrigin={currentOrigin}
            onToggleVoice={() => setMode("voice")}
            surfaceConfig={surfaceConfig}
          />
        )}
      </div>
    </div>
  );
}
