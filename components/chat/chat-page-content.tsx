"use client";

import type { ChatStatus } from "ai";
import {
  ArrowUpRight,
  Brain,
  Briefcase,
  FileText,
  Loader2,
  Menu,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";
import { nanoid } from "nanoid";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChatPromptComposer } from "@/src/components/ai-elements/chat-prompt-composer";
import { PromptInputProvider } from "@/src/components/ai-elements/prompt-input";
import {
  ChatCvDropOverlay,
  type ChatCvUploadController,
  useChatCvUpload,
} from "@/src/components/ai-elements/use-chat-cv-upload";
import { useChatContext } from "./chat-context-provider";
import { ChatHistorySidebar } from "./chat-history-sidebar";
import { ChatMessages, type ChatSuggestion } from "./chat-messages";
import { readSessionStorage, writeSessionStorage } from "./chat-session-storage";
import { useChatThread } from "./use-chat-thread";
import { VoiceSession } from "./voice-session";

const CHAT_MODELS = [
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite", provider: "Google" },
  { id: "gemini-3-flash", label: "Gemini 3 Flash", provider: "Google" },
  { id: "gpt-5-nano", label: "GPT-5 Nano", provider: "OpenAI" },
  { id: "grok-4", label: "Grok 4", provider: "xAI" },
] as const;

const MODE_OPTIONS = [
  { id: "snel", label: "Snel" },
  { id: "gemiddeld", label: "Gemiddeld" },
  { id: "grondig", label: "Grondig" },
] as const;

const SESSION_KEY = "motian-chat-session";

function persistSessionId(sessionId: string) {
  writeSessionStorage(SESSION_KEY, sessionId);
}

function getOrCreateSessionId(): string {
  const existing = readSessionStorage(SESSION_KEY);
  if (existing) return existing;

  const sessionId = nanoid();
  writeSessionStorage(SESSION_KEY, sessionId);
  return sessionId;
}

type SpeedMode = (typeof MODE_OPTIONS)[number]["id"];
type ChatSurfaceContext = {
  route: string;
  entityId: string | null;
  entityType: "opdracht" | "kandidaat" | null;
};

type ChatSurfaceConfig = {
  title: string;
  subtitle: string;
  contextBadge?: string;
  conversationLabel: string;
  emptyStateTitle: string;
  emptyStateDescription: string;
  composerPlaceholder: string;
  composerHint: string;
  composerContextHint?: string;
  starterPrompts: ChatSuggestion[];
  followUpPrompts: ChatSuggestion[];
};

function getContextLabel(ctx: ChatSurfaceContext) {
  if (ctx.entityType === "opdracht") return "Verder vanuit vacature";
  if (ctx.entityType === "kandidaat") return "Verder vanuit kandidaat";
  if (ctx.route !== "/chat") return `Verder vanuit ${ctx.route}`;
  return "Algemene chat";
}

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

function getChatSurfaceConfig(ctx: ChatSurfaceContext): ChatSurfaceConfig {
  switch (ctx.entityType) {
    case "opdracht":
      return {
        title: "Vacatureassistent",
        subtitle:
          "Werk in de context van deze vacature voor snellere matches en scherpere intake-notes.",
        contextBadge: "Vacaturecontext",
        conversationLabel: "Chatgesprek in vacaturecontext",
        emptyStateTitle: "Wat wil je weten over deze vacature?",
        emptyStateDescription:
          "De huidige vacaturecontext wordt automatisch meegenomen. Vraag om een samenvatting, matchanalyse of recruiter-ready vervolgactie.",
        composerPlaceholder:
          "Vraag om een samenvatting, matchanalyse of outreach voor deze vacature",
        composerHint: "Enter om te verzenden · Shift+Enter voor een nieuwe regel",
        composerContextHint: "Deze chat gebruikt automatisch de huidige vacature als context.",
        starterPrompts: JOB_STARTER_PROMPTS,
        followUpPrompts: JOB_FOLLOW_UP_PROMPTS,
      };
    case "kandidaat":
      return {
        title: "Kandidaatassistent",
        subtitle:
          "Gebruik het huidige profiel als context voor snellere samenvattingen, pitches en matches.",
        contextBadge: "Kandidaatcontext",
        conversationLabel: "Chatgesprek in kandidaatcontext",
        emptyStateTitle: "Wat wil je uit dit profiel halen?",
        emptyStateDescription:
          "De huidige kandidaatcontext wordt automatisch meegenomen. Vraag om een profielsamenvatting, risicocheck of passende opdrachten.",
        composerPlaceholder:
          "Vraag om een profielsamenvatting, pitch of matchsuggestie voor deze kandidaat",
        composerHint: "Enter om te verzenden · Shift+Enter voor een nieuwe regel",
        composerContextHint: "Deze chat gebruikt automatisch de huidige kandidaat als context.",
        starterPrompts: CANDIDATE_STARTER_PROMPTS,
        followUpPrompts: CANDIDATE_FOLLOW_UP_PROMPTS,
      };
    default:
      return {
        title: "Motian AI",
        subtitle:
          "Werk sneller met vacatures, kandidaten, marktanalyse en CV-acties vanuit één chat.",
        conversationLabel: "Chatgesprek met Motian AI",
        emptyStateTitle: "Waar wil je vandaag op sturen?",
        emptyStateDescription:
          "Start met een concrete vraag of kies een starter hieronder om vacatures, kandidaten of marktdynamiek sneller te analyseren.",
        composerPlaceholder: "Vraag om vacatures, kandidaten, analyses of hulp bij een CV-upload",
        composerHint: "Enter om te verzenden · Shift+Enter voor een nieuwe regel",
        composerContextHint:
          "Je kunt hier ook een CV uploaden om direct een profielanalyse te starten.",
        starterPrompts: GENERAL_STARTER_PROMPTS,
        followUpPrompts: GENERAL_FOLLOW_UP_PROMPTS,
      };
  }
}

function ChatPageHeader({
  title,
  subtitle,
  contextBadge,
  onOpenSidebar,
  onNewSession,
}: {
  title: string;
  subtitle: string;
  contextBadge?: string;
  onOpenSidebar: () => void;
  onNewSession: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/95 backdrop-blur">
      <div className="flex min-h-14 items-center justify-between gap-3 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            aria-controls="chat-history-sidebar"
            aria-label="Open gesprekken"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-sm font-semibold text-foreground sm:text-base">
                {title}
              </h1>
              {contextBadge ? (
                <span className="rounded-full border border-primary/15 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary">
                  {contextBadge}
                </span>
              ) : null}
            </div>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">{subtitle}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onNewSession}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Nieuw gesprek"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Nieuw gesprek</span>
        </button>
      </div>
    </header>
  );
}

function ChatComposer({
  modelId,
  setModelId,
  speedMode,
  setSpeedMode,
  status,
  stop,
  sendMessage,
  onToggleVoice,
  placeholder,
  composerHint,
  composerContextHint,
  cvUpload,
}: {
  modelId: string;
  setModelId: (id: string) => void;
  speedMode: SpeedMode;
  setSpeedMode: (mode: SpeedMode) => void;
  status: ChatStatus;
  stop: () => void;
  sendMessage: (message: { text: string }) => void;
  onToggleVoice: () => void;
  placeholder: string;
  composerHint: string;
  composerContextHint?: string;
  cvUpload: ChatCvUploadController;
}) {
  return (
    <ChatPromptComposer
      composerContextHint={composerContextHint}
      composerHint={composerHint}
      cvUpload={cvUpload}
      modelId={modelId}
      modelOptions={CHAT_MODELS}
      onModelIdChange={setModelId}
      onSendMessage={sendMessage}
      onStop={stop}
      onToggleVoice={onToggleVoice}
      onSpeedModeChange={(value) => setSpeedMode(value as SpeedMode)}
      placeholder={placeholder}
      speedMode={speedMode}
      speedOptions={MODE_OPTIONS}
      status={status}
    />
  );
}

function ChatSessionSurface({
  currentOrigin,
  hasMoreHistory,
  loadingOlder,
  messages,
  modelId,
  onLoadOlder,
  onSuggestion,
  onToggleVoice,
  sendMessage,
  setModelId,
  setSpeedMode,
  speedMode,
  status,
  stop,
  surfaceConfig,
}: {
  currentOrigin?: string | null;
  hasMoreHistory: boolean;
  loadingOlder: boolean;
  messages: Parameters<typeof ChatMessages>[0]["messages"];
  modelId: string;
  onLoadOlder: () => void;
  onSuggestion: (text: string) => void;
  onToggleVoice: () => void;
  sendMessage: (message: { text: string }) => void;
  setModelId: (id: string) => void;
  setSpeedMode: (mode: SpeedMode) => void;
  speedMode: SpeedMode;
  status: ChatStatus;
  stop: () => void;
  surfaceConfig: ChatSurfaceConfig;
}) {
  const cvUpload = useChatCvUpload({ onSendMessage: sendMessage });

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <ChatCvDropOverlay active={cvUpload.isDraggingFile} variant="page" />

      <div className="flex min-h-0 flex-1 flex-col">
        <ChatMessages
          messages={messages}
          status={status}
          currentOrigin={currentOrigin}
          onSuggestion={onSuggestion}
          hasOlderMessages={hasMoreHistory}
          loadingOlder={loadingOlder}
          onLoadOlder={onLoadOlder}
          emptyStateTitle={surfaceConfig.emptyStateTitle}
          emptyStateDescription={surfaceConfig.emptyStateDescription}
          emptyStatePrompts={surfaceConfig.starterPrompts}
          followUpPrompts={surfaceConfig.followUpPrompts}
          conversationLabel={surfaceConfig.conversationLabel}
        />
      </div>

      <ChatComposer
        cvUpload={cvUpload}
        modelId={modelId}
        setModelId={setModelId}
        speedMode={speedMode}
        setSpeedMode={setSpeedMode}
        status={status}
        stop={stop}
        sendMessage={sendMessage}
        onToggleVoice={onToggleVoice}
        placeholder={surfaceConfig.composerPlaceholder}
        composerHint={surfaceConfig.composerHint}
        composerContextHint={surfaceConfig.composerContextHint}
      />
    </div>
  );
}

function ChatSession({
  sessionId,
  ctx,
  modelId,
  setModelId,
  surfaceConfig,
  onSessionActivity,
  onToggleVoice,
  currentOrigin,
}: {
  sessionId: string;
  ctx: ChatSurfaceContext;
  modelId: string;
  setModelId: (id: string) => void;
  surfaceConfig: ChatSurfaceConfig;
  onSessionActivity?: () => void;
  onToggleVoice: () => void;
  currentOrigin?: string | null;
}) {
  const [speedMode, setSpeedMode] = useState<SpeedMode>("gemiddeld");

  const { messages, sendMessage, status, stop, hasMoreHistory, loadingOlder, loadOlder } =
    useChatThread({
      sessionId,
      context: ctx,
      modelId,
      speedMode,
      onSessionActivity,
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
      <ChatSessionSurface
        currentOrigin={currentOrigin}
        hasMoreHistory={hasMoreHistory}
        loadingOlder={loadingOlder}
        messages={messages}
        modelId={modelId}
        onLoadOlder={handleLoadOlder}
        onSuggestion={handleSuggestion}
        onToggleVoice={onToggleVoice}
        sendMessage={sendMessage}
        setModelId={setModelId}
        setSpeedMode={setSpeedMode}
        speedMode={speedMode}
        status={status}
        stop={stop}
        surfaceConfig={surfaceConfig}
      />
    </PromptInputProvider>
  );
}

export function ChatPageContent({ currentOrigin = null }: { currentOrigin?: string | null }) {
  const {
    activeContext,
    loadSession,
    mode,
    modelId,
    sessionId: providerSessionId,
    sessionLoadError,
    setMode,
    setModelId,
    startNewSession,
  } = useChatContext();
  const surfaceConfig = getChatSurfaceConfig(activeContext);
  const [sessionId, setSessionId] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);
  const hasSourceContext = activeContext.route !== "/chat";

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const nextSessionId = providerSessionId || getOrCreateSessionId();
      persistSessionId(nextSessionId);
      setSessionId(nextSessionId);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [providerSessionId]);

  const handleSelectSession = useCallback(
    async (id: string) => {
      try {
        await loadSession(id);
        persistSessionId(id);
        setSessionId(id);
        setHistoryRefreshToken((current) => current + 1);
        setSidebarOpen(false);
      } catch {
        // Keep the current conversation visible and leave the sidebar open so the user can retry.
      }
    },
    [loadSession],
  );

  const handleNewSession = useCallback(() => {
    startNewSession();
    setHistoryRefreshToken((current) => current + 1);
    setSidebarOpen(false);
  }, [startNewSession]);

  const handleSessionActivity = useCallback(() => {
    setHistoryRefreshToken((current) => current + 1);
  }, []);

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden bg-background">
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Sluit zijbalk"
        />
      ) : null}

      <aside
        id="chat-history-sidebar"
        aria-label="Chat geschiedenis"
        className={`fixed inset-y-0 left-0 z-40 w-[280px] transform transition-transform duration-200 ease-in-out lg:relative lg:z-auto lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <ChatHistorySidebar
          activeSessionId={sessionId || providerSessionId || null}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSession}
          onClose={() => setSidebarOpen(false)}
          refreshToken={historyRefreshToken}
        />
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <ChatPageHeader
          title={surfaceConfig.title}
          subtitle={surfaceConfig.subtitle}
          contextBadge={surfaceConfig.contextBadge}
          onOpenSidebar={() => setSidebarOpen(true)}
          onNewSession={handleNewSession}
        />

        {hasSourceContext ? (
          <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2 text-xs text-muted-foreground sm:px-4">
            <span className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] text-foreground">
              {getContextLabel(activeContext)}
            </span>
            <Link
              href={activeContext.route}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors hover:bg-accent hover:text-foreground"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              Bronpagina
            </Link>
          </div>
        ) : null}

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
        ) : sessionId ? (
          <ChatSession
            key={`${sessionId}-${modelId}`}
            sessionId={sessionId}
            ctx={activeContext}
            modelId={modelId}
            setModelId={setModelId}
            surfaceConfig={surfaceConfig}
            onSessionActivity={handleSessionActivity}
            onToggleVoice={() => setMode("voice")}
            currentOrigin={currentOrigin}
          />
        ) : (
          <div
            className="flex flex-1 items-center justify-center p-4"
            aria-live="polite"
            aria-busy="true"
          >
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="sr-only">Chat wordt geladen</span>
          </div>
        )}
      </div>
    </div>
  );
}
