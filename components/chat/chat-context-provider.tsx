"use client";

import type { UIMessage } from "ai";
import { nanoid } from "nanoid";
import { useParams, usePathname } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  markPersistedChatSession,
  readSessionStorage,
  writeSessionStorage,
} from "./chat-session-storage";

export const CHAT_MODELS = [
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite", provider: "Google" },
  { id: "gemini-3-flash", label: "Gemini 3 Flash", provider: "Google" },
  { id: "gpt-5-nano", label: "GPT-5 Nano", provider: "OpenAI" },
  { id: "grok-4", label: "Grok 4", provider: "xAI" },
] as const;

export const MODE_OPTIONS = [
  { id: "snel", label: "Snel" },
  { id: "gemiddeld", label: "Gemiddeld" },
  { id: "grondig", label: "Grondig" },
] as const;

export type ChatRouteContext = {
  route: string;
  entityType: "opdracht" | "kandidaat" | null;
  entityId: string | null;
};

type ChatSurfaceMode = "text" | "voice";
export type ChatSpeedMode = (typeof MODE_OPTIONS)[number]["id"];

const SESSION_KEY = "motian-chat-session";
const MODEL_KEY = "motian-chat-model";
const SPEED_KEY = "motian-chat-speed";
const PINNED_CONTEXT_KEY = "motian-chat-context";
const DEFAULT_MODEL_ID = CHAT_MODELS[0].id;
const DEFAULT_SPEED_MODE: ChatSpeedMode = "gemiddeld";

export function resolveRouteContext(pathname: string, id: string | null): ChatRouteContext {
  if (pathname.startsWith("/opdrachten/") && id) {
    return { route: pathname, entityType: "opdracht", entityId: id };
  }
  if (pathname.startsWith("/professionals/") && id) {
    return { route: pathname, entityType: "kandidaat", entityId: id };
  }

  return { route: pathname, entityType: null, entityId: null };
}

export function isInternalChatRoute(route: unknown): route is string {
  return typeof route === "string" && route.startsWith("/") && !route.startsWith("//");
}

export function isChatRouteContext(value: unknown): value is ChatRouteContext {
  if (typeof value !== "object" || value == null) return false;

  const candidate = value as Record<string, unknown>;
  const entityType = candidate.entityType;

  return (
    isInternalChatRoute(candidate.route) &&
    (candidate.entityId == null || typeof candidate.entityId === "string") &&
    (entityType == null || entityType === "opdracht" || entityType === "kandidaat")
  );
}

type SessionResponse = {
  messages?: UIMessage[];
  context?: unknown;
};

type LoadedSessionState = {
  messages: UIMessage[];
  mode: ChatSurfaceMode;
  pinnedContext: ChatRouteContext | null;
  sessionId: string;
};

export function resolveActiveContext(
  pathname: string,
  routeContext: ChatRouteContext,
  pinnedContext: ChatRouteContext | null,
) {
  if (pathname === "/chat") {
    return pinnedContext ?? routeContext;
  }

  return routeContext;
}

export function buildLoadedSessionState(
  nextSessionId: string,
  session: SessionResponse,
): LoadedSessionState {
  return {
    messages: Array.isArray(session.messages) ? session.messages : [],
    mode: "text",
    pinnedContext: isChatRouteContext(session.context) ? session.context : null,
    sessionId: nextSessionId,
  };
}

export async function fetchChatSession(
  nextSessionId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LoadedSessionState> {
  const response = await fetchImpl(`/api/chat-sessies/${nextSessionId}`);

  if (!response.ok) {
    throw new Error("Sessie laden mislukt");
  }

  const session = (await response.json()) as SessionResponse;
  return buildLoadedSessionState(nextSessionId, session);
}

function useChatRuntimeValue(routeContext: ChatRouteContext, pathname: string) {
  const [ready, setReady] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [modelId, setModelId] = useState<string>(DEFAULT_MODEL_ID);
  const [speedMode, setSpeedMode] = useState<ChatSpeedMode>(DEFAULT_SPEED_MODE);
  const [mode, setMode] = useState<ChatSurfaceMode>("text");
  const [pinnedContext, setPinnedContext] = useState<ChatRouteContext | null>(null);
  const [sessionLoadError, setSessionLoadError] = useState<string | null>(null);

  useEffect(() => {
    const storedSessionId = readSessionStorage(SESSION_KEY);
    const storedModelId = readSessionStorage(MODEL_KEY);
    const storedSpeedMode = readSessionStorage(SPEED_KEY);
    const storedPinnedContext = readSessionStorage(PINNED_CONTEXT_KEY);

    setSessionId(storedSessionId || nanoid());

    if (storedModelId && CHAT_MODELS.some((model) => model.id === storedModelId)) {
      setModelId(storedModelId);
    }

    if (storedSpeedMode && MODE_OPTIONS.some((option) => option.id === storedSpeedMode)) {
      setSpeedMode(storedSpeedMode as ChatSpeedMode);
    }

    if (storedPinnedContext) {
      try {
        const parsed = JSON.parse(storedPinnedContext);
        if (isChatRouteContext(parsed)) {
          setPinnedContext(parsed);
        }
      } catch {
        writeSessionStorage(PINNED_CONTEXT_KEY, null);
      }
    }

    setReady(true);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    writeSessionStorage(SESSION_KEY, sessionId);
  }, [sessionId]);

  useEffect(() => {
    writeSessionStorage(MODEL_KEY, modelId);
  }, [modelId]);

  useEffect(() => {
    writeSessionStorage(SPEED_KEY, speedMode);
  }, [speedMode]);

  useEffect(() => {
    writeSessionStorage(PINNED_CONTEXT_KEY, pinnedContext ? JSON.stringify(pinnedContext) : null);
  }, [pinnedContext]);

  const activeContext = useMemo(
    () => resolveActiveContext(pathname, routeContext, pinnedContext),
    [pathname, pinnedContext, routeContext],
  );

  const startNewSession = useCallback(
    ({ preservePinnedContext = pathname === "/chat" } = {}) => {
      setSessionId(nanoid());
      setMode("text");
      setSessionLoadError(null);

      if (!preservePinnedContext) {
        setPinnedContext(null);
      }
    },
    [pathname],
  );

  const loadSession = useCallback(async (nextSessionId: string) => {
    try {
      const loadedSession = await fetchChatSession(nextSessionId);

      // Guard against stale async responses: only apply if this is still the requested session
      if (loadedSession.sessionId !== nextSessionId) {
        return;
      }

      setSessionId(loadedSession.sessionId);
      setMode(loadedSession.mode);
      setPinnedContext(loadedSession.pinnedContext);
      setSessionLoadError(null);
      markPersistedChatSession(loadedSession.sessionId);
    } catch (error) {
      setSessionLoadError(error instanceof Error ? error.message : "Sessie laden mislukt");
      throw error;
    }
  }, []);

  const prepareFullPageHandoff = useCallback(() => {
    setPinnedContext(routeContext);
    setPanelOpen(false);
    setMode("text");
    setSessionLoadError(null);
  }, [routeContext]);

  return {
    activeContext,
    mode,
    modelId,
    panelOpen,
    pathname,
    pinnedContext,
    ready,
    routeContext,
    sessionId,
    sessionLoadError,
    setMode,
    setModelId,
    setPanelOpen,
    setPinnedContext,
    setSpeedMode,
    speedMode,
    startNewSession,
    loadSession,
    prepareFullPageHandoff,
  };
}

type ChatContextValue = ReturnType<typeof useChatRuntimeValue>;

const ChatCtx = createContext<ChatContextValue | null>(null);

export function useChatContext() {
  const value = useContext(ChatCtx);

  if (!value) {
    throw new Error("useChatContext must be used within ChatContextProvider");
  }

  return value;
}

export function ChatContextProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const params = useParams<{ id?: string }>();

  const routeContext = useMemo(
    () => resolveRouteContext(pathname, params?.id ?? null),
    [pathname, params?.id],
  );
  const value = useChatRuntimeValue(routeContext, pathname);

  return <ChatCtx.Provider value={value}>{children}</ChatCtx.Provider>;
}
