import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mockPush, mockUseChatContext } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockUseChatContext: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: unknown; href: string }) =>
    createElement("a", { href, ...props }, children),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  usePathname: () => "/chat",
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("../src/components/ai-elements/prompt-input", () => ({
  PromptInput: ({ children }: { children: unknown }) => createElement("form", null, children),
  PromptInputActionAddAttachments: ({ label }: { label: string }) =>
    createElement("button", { type: "button" }, label),
  PromptInputActionMenu: ({ children }: { children: unknown }) =>
    createElement("div", null, children),
  PromptInputActionMenuContent: ({ children }: { children: unknown }) =>
    createElement("div", null, children),
  PromptInputActionMenuItem: ({ children, ...props }: Record<string, unknown>) =>
    createElement("button", { type: "button", ...props }, children),
  PromptInputActionMenuTrigger: ({ children, ...props }: Record<string, unknown>) =>
    createElement("button", { type: "button", ...props }, children ?? "+"),
  PromptInputButton: ({ children, ...props }: Record<string, unknown>) =>
    createElement("button", { type: "button", ...props }, children),
  PromptInputFooter: ({ children, className }: { children: unknown; className?: string }) =>
    createElement("div", { className }, children),
  PromptInputSelect: ({ children }: { children: unknown }) => createElement("div", null, children),
  PromptInputSelectContent: ({ children }: { children: unknown }) =>
    createElement("div", null, children),
  PromptInputSelectItem: ({ children, value }: { children: unknown; value: string }) =>
    createElement("div", { "data-value": value }, children),
  PromptInputSelectTrigger: ({ children, className }: { children: unknown; className?: string }) =>
    createElement("button", { className, type: "button" }, children),
  PromptInputSelectValue: () => createElement("span", null, "select"),
  PromptInputSubmit: ({ children, ...props }: Record<string, unknown>) =>
    createElement("button", { type: "button", ...props }, children ?? "submit"),
  PromptInputTextarea: ({ placeholder }: { placeholder?: string }) =>
    createElement("textarea", { placeholder }),
  PromptInputTools: ({ children, className }: { children: unknown; className?: string }) =>
    createElement("div", { className }, children),
}));

vi.mock("../components/chat/chat-context-provider", async () => {
  const actual = await vi.importActual<typeof import("../components/chat/chat-context-provider")>(
    "../components/chat/chat-context-provider",
  );

  return {
    ...actual,
    useChatContext: () => mockUseChatContext(),
  };
});

vi.mock("../components/chat/chat-history-sidebar", () => ({
  ChatHistorySidebar: ({ activeSessionId }: { activeSessionId: string | null }) =>
    createElement("aside", { "data-active-session": activeSessionId ?? "" }, "history"),
}));

vi.mock("../components/chat/chat-messages", () => ({
  ChatMessages: ({ layout, messages }: { layout: string; messages: unknown[] }) =>
    createElement(
      "div",
      { "data-layout": layout, "data-message-count": messages.length },
      "messages",
    ),
}));

vi.mock("../components/chat/voice-session", () => ({
  VoiceSession: () => createElement("div", null, "voice"),
}));

vi.mock("../src/components/ai-elements/conversation", () => ({
  Conversation: ({ children, className }: { children: unknown; className?: string }) =>
    createElement("section", { className }, children),
  ConversationContent: ({ children, className }: { children: unknown; className?: string }) =>
    createElement("div", { className }, children),
  ConversationScrollButton: () => createElement("button", { type: "button" }, "scroll"),
}));

vi.mock("../src/components/ai-elements/message", () => ({
  Message: ({ children }: { children: unknown }) => createElement("article", null, children),
  MessageContent: ({ children }: { children: unknown }) => createElement("div", null, children),
  MessageResponse: ({ children }: { children: unknown }) => createElement("p", null, children),
}));

vi.mock("../components/chat/chat-tool-call", () => ({
  ChatToolCall: () => createElement("div", null, "tool-call"),
}));

vi.mock("../components/chat/genui", () => ({
  KandidaatGenUICard: () => createElement("div", null, "candidate-card"),
  MatchGenUICard: () => createElement("div", null, "match-card"),
  OpdrachtGenUICard: () => createElement("div", null, "job-card"),
  ToolErrorBlock: ({ message }: { message: string }) => createElement("div", null, message),
}));

afterEach(() => {
  vi.clearAllMocks();
});

function createMockChatContext(overrides: Record<string, unknown> = {}) {
  return {
    activeContext: {
      route: "/opdrachten/123",
      entityId: "123",
      entityType: "opdracht",
    },
    loadSession: vi.fn().mockResolvedValue(undefined),
    messages: [],
    mode: "text",
    panelOpen: true,
    pathname: "/opdrachten/123",
    prepareFullPageHandoff: vi.fn(),
    ready: true,
    sendMessage: vi.fn(),
    sessionId: "session-1",
    sessionLoadError: null,
    setMode: vi.fn(),
    setModelId: vi.fn(),
    setPanelOpen: vi.fn(),
    setPinnedContext: vi.fn(),
    setSpeedMode: vi.fn(),
    speedMode: "gemiddeld",
    startNewSession: vi.fn(),
    status: "ready",
    stop: vi.fn(),
    ...overrides,
  };
}

describe("chat widget continuity", () => {
  it("keeps pinned context on /chat and rejects external persisted routes", async () => {
    const {
      buildLoadedSessionState,
      fetchChatSession,
      isInternalChatRoute,
      resolveActiveContext,
      resolveRouteContext,
    } = await vi.importActual<typeof import("../components/chat/chat-context-provider")>(
      "../components/chat/chat-context-provider",
    );

    expect(isInternalChatRoute("/opdrachten/123")).toBe(true);
    expect(isInternalChatRoute("//evil.example/redirect")).toBe(false);
    expect(isInternalChatRoute("https://evil.example/redirect")).toBe(false);

    const widgetContext = resolveRouteContext("/professionals/42", "42");
    const pinnedContext = resolveRouteContext("/opdrachten/123", "123");

    expect(resolveActiveContext("/chat", widgetContext, pinnedContext)).toEqual(pinnedContext);

    const loadedState = buildLoadedSessionState("session-2", {
      messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "Hoi" }] }],
      context: {
        route: "https://evil.example/redirect",
        entityId: "999",
        entityType: "opdracht",
      },
    });

    expect(loadedState.messages).toHaveLength(1);
    expect(loadedState.pinnedContext).toBeNull();

    await expect(
      fetchChatSession("missing", async () => new Response(null, { status: 404 })),
    ).rejects.toThrow("Sessie laden mislukt");
  });

  it("rewrites internal job links without touching literal code", async () => {
    const { normalizeChatJobHref, rewriteChatJobLinks } = await vi.importActual<
      typeof import("../components/chat/chat-message-links")
    >("../components/chat/chat-message-links");

    expect(normalizeChatJobHref("/opdrachten/12345678-1234-4123-8123-123456789abc")).toBe(
      "/opdrachten/12345678-1234-4123-8123-123456789abc",
    );

    expect(
      rewriteChatJobLinks(
        "Bekijk [de opdracht](https://motian.ai/opdrachten/12345678-1234-4123-8123-123456789abc) en laat `[/opdrachten/12345678-1234-4123-8123-123456789abc](https://motian.ai/opdrachten/12345678-1234-4123-8123-123456789abc)` met rust.",
      ),
    ).toContain(
      '<motian-job-link href="/opdrachten/12345678-1234-4123-8123-123456789abc">de opdracht</motian-job-link>',
    );
  });

  it("renders the full chat page with shared context and a visible load failure", async () => {
    const { ChatPageContent } = await import("../components/chat/chat-page-content");

    mockUseChatContext.mockReturnValue(
      createMockChatContext({ sessionLoadError: "Sessie laden mislukt" }),
    );

    const html = renderToStaticMarkup(createElement(ChatPageContent));

    expect(html).toContain("Verder vanuit opdracht");
    expect(html).toContain("Bronpagina");
    expect(html).toContain("Sessie laden mislukt");
    expect(html).toContain('aria-label="Open gesprekken"');
    expect(html).toContain('aria-label="Nieuw gesprek"');
  });

  it("renders widget controls with explicit accessible names and hides on /chat", async () => {
    const { ChatPanel } = await import("../components/chat/chat-panel");

    mockUseChatContext.mockReturnValue(createMockChatContext({ panelOpen: true }));

    const openHtml = renderToStaticMarkup(createElement(ChatPanel));
    expect(openHtml).toContain('aria-label="Nieuw gesprek"');
    expect(openHtml).toContain('aria-label="Open volledige chat"');
    expect(openHtml).toContain('aria-label="Sluit chatwidget"');
    expect(openHtml).toContain('aria-label="CV of document uploaden"');
    expect(openHtml).toContain('aria-label="Verstuur bericht"');

    mockUseChatContext.mockReturnValue(
      createMockChatContext({ panelOpen: false, pathname: "/opdrachten/123" }),
    );

    const closedHtml = renderToStaticMarkup(createElement(ChatPanel));
    expect(closedHtml).toContain('aria-label="Open chatwidget"');

    mockUseChatContext.mockReturnValue(
      createMockChatContext({ panelOpen: true, pathname: "/chat" }),
    );

    expect(renderToStaticMarkup(createElement(ChatPanel))).toBe("");
  });

  it("renders the compact widget message state at runtime", async () => {
    const { ChatMessages } = await vi.importActual<
      typeof import("../components/chat/chat-messages")
    >("../components/chat/chat-messages");

    const html = renderToStaticMarkup(
      createElement(ChatMessages, {
        layout: "widget",
        messages: [],
        onSuggestion: vi.fn(),
        status: "ready",
      }),
    );

    expect(html).toContain("Hoe kan ik je helpen?");
    expect(html).toContain("Zoek vacatures");
    expect(html).toContain("CV uploaden");
  });
});
