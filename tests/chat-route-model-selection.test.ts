import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Provider mocks (must be before ai-models import) ────────────────
vi.mock("@ai-sdk/google", () => ({ google: vi.fn((id: string) => `google:${id}`) }));
vi.mock("@ai-sdk/openai", () => ({
  openai: Object.assign(
    vi.fn((id: string) => `openai:${id}`),
    {
      textEmbeddingModel: vi.fn((id: string) => `openai-embed:${id}`),
    },
  ),
}));
vi.mock("@ai-sdk/xai", () => ({ xai: vi.fn((id: string) => `xai:${id}`) }));
vi.mock("langsmith/experimental/vercel", () => ({ wrapAISDK: vi.fn((mod: unknown) => mod) }));

// ── Route-level mocks ───────────────────────────────────────────────
const mockRateLimitCheck = vi.fn<
  [string],
  { success: boolean; remaining: number; reset: number }
>();
vi.mock("@/src/lib/rate-limit", () => ({
  rateLimit: () => ({ check: mockRateLimitCheck }),
}));

vi.mock("@/src/db", () => ({
  db: { update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })) },
  eq: vi.fn(),
  and: vi.fn(),
  isNull: vi.fn(),
}));

vi.mock("@/src/db/schema", () => ({
  chatSessions: { sessionId: "sessionId", title: "title" },
}));

const mockBuildSystemPrompt = vi.fn<[unknown], Promise<string>>().mockResolvedValue("system");
const mockGetRecruitmentTools = vi.fn().mockReturnValue({});
vi.mock("@/src/ai/agent", () => ({
  buildSystemPrompt: (...args: unknown[]) => mockBuildSystemPrompt(args[0]),
  getRecruitmentTools: (...args: unknown[]) => mockGetRecruitmentTools(args[0]),
}));

const mockPersistMessages = vi.fn<[unknown], Promise<void>>().mockResolvedValue(undefined);
const mockGetRecentMessagesForContext = vi.fn().mockResolvedValue([]);
const mockGetSessionRequestSnapshot = vi.fn().mockResolvedValue({ messageCount: 0, tokensUsed: 0 });
const mockIncrementSessionTokens = vi.fn().mockResolvedValue(undefined);
vi.mock("@/src/services/chat-sessions", () => ({
  persistMessages: (...args: unknown[]) => mockPersistMessages(args[0]),
  getRecentMessagesForContext: (...args: unknown[]) => mockGetRecentMessagesForContext(...args),
  getSessionRequestSnapshot: (...args: unknown[]) => mockGetSessionRequestSnapshot(...args),
  incrementSessionTokens: (...args: unknown[]) => mockIncrementSessionTokens(...args),
}));

vi.mock("next/server", () => ({ after: vi.fn((fn: () => void) => fn()) }));

vi.mock("ai", () => ({
  convertToModelMessages: vi.fn((msgs: unknown) => msgs),
  stepCountIs: vi.fn((n: number) => n),
}));

vi.mock("nanoid", () => ({ nanoid: vi.fn(() => "test-nanoid-id") }));

// ── Imports (after mocks) ───────────────────────────────────────────
import {
  CHAT_MODELS,
  type ChatModelId,
  DEFAULT_CHAT_MODEL,
  resolveChatModel,
} from "@/src/lib/ai-models";

// --------------------------------------------------------------------------
// Describe 1: resolveChatModel (pure function, provider mocks only)
// --------------------------------------------------------------------------
describe("resolveChatModel", () => {
  it("returns default model when no id is provided", () => {
    const result = resolveChatModel();
    expect(result).toBe(CHAT_MODELS[DEFAULT_CHAT_MODEL].model);
  });

  it("returns default model when id is undefined", () => {
    const result = resolveChatModel(undefined);
    expect(result).toBe(CHAT_MODELS[DEFAULT_CHAT_MODEL].model);
  });

  it("returns default model when id is empty string", () => {
    const result = resolveChatModel("");
    expect(result).toBe(CHAT_MODELS[DEFAULT_CHAT_MODEL].model);
  });

  it("returns default model when id is invalid", () => {
    const result = resolveChatModel("nonexistent-model");
    expect(result).toBe(CHAT_MODELS[DEFAULT_CHAT_MODEL].model);
  });

  it.each([
    ["gemini-3.1-flash-lite", "google:gemini-3.1-flash-lite-preview"],
    ["gemini-3-flash", "google:gemini-3-flash-preview"],
    ["gemini-2.5-flash-lite", "google:gemini-2.5-flash-lite"],
    ["gpt-5-nano", "openai:gpt-5-nano-2025-08-07"],
    ["grok-4", "xai:grok-4-1-fast-reasoning"],
  ] as [ChatModelId, string][])("returns correct model for id '%s'", (id, expectedModel) => {
    const result = resolveChatModel(id);
    expect(result).toBe(expectedModel);
  });

  it("default chat model is gemini-3.1-flash-lite", () => {
    expect(DEFAULT_CHAT_MODEL).toBe("gemini-3.1-flash-lite");
  });
});

// --------------------------------------------------------------------------
// Describe 2: Chat route rate limiting and token budget
// --------------------------------------------------------------------------
describe("Chat route POST", () => {
  // We need to dynamically import the route so env vars are captured at
  // module-evaluation time for the CHAT_MAX_TOKENS_PER_SESSION IIFE.
  // For the basic rate-limit / validation tests we import once; for the
  // token-budget test we re-import with a patched env.

  let POST: (req: Request) => Promise<Response>;

  function makeRequest(body: Record<string, unknown>, headers?: Record<string, string>): Request {
    return new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  }

  function userMessage(text: string) {
    return {
      id: "msg-1",
      role: "user",
      parts: [{ type: "text", text }],
    };
  }

  beforeEach(async () => {
    vi.resetModules();

    // Re-apply provider mocks after resetModules
    vi.doMock("@ai-sdk/google", () => ({ google: vi.fn((id: string) => `google:${id}`) }));
    vi.doMock("@ai-sdk/openai", () => ({
      openai: Object.assign(
        vi.fn((id: string) => `openai:${id}`),
        {
          textEmbeddingModel: vi.fn((id: string) => `openai-embed:${id}`),
        },
      ),
    }));
    vi.doMock("@ai-sdk/xai", () => ({ xai: vi.fn((id: string) => `xai:${id}`) }));
    vi.doMock("langsmith/experimental/vercel", () => ({
      wrapAISDK: vi.fn((mod: unknown) => mod),
    }));

    vi.doMock("@/src/lib/rate-limit", () => ({
      rateLimit: () => ({ check: mockRateLimitCheck }),
    }));

    vi.doMock("@/src/db", () => ({
      db: { update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })) },
      eq: vi.fn(),
      and: vi.fn(),
      isNull: vi.fn(),
    }));

    vi.doMock("@/src/db/schema", () => ({
      chatSessions: { sessionId: "sessionId", title: "title" },
    }));

    vi.doMock("@/src/ai/agent", () => ({
      buildSystemPrompt: mockBuildSystemPrompt,
      getRecruitmentTools: mockGetRecruitmentTools,
    }));

    vi.doMock("@/src/services/chat-sessions", () => ({
      persistMessages: mockPersistMessages,
      getRecentMessagesForContext: mockGetRecentMessagesForContext,
      getSessionRequestSnapshot: mockGetSessionRequestSnapshot,
      incrementSessionTokens: mockIncrementSessionTokens,
    }));

    vi.doMock("next/server", () => ({ after: vi.fn((fn: () => void) => fn()) }));
    vi.doMock("ai", () => ({
      convertToModelMessages: vi.fn((msgs: unknown) => msgs),
      stepCountIs: vi.fn((n: number) => n),
    }));
    vi.doMock("nanoid", () => ({ nanoid: vi.fn(() => "test-nanoid-id") }));

    // Default: rate limit passes
    mockRateLimitCheck.mockReturnValue({
      success: true,
      remaining: 19,
      reset: Date.now() + 60_000,
    });

    // Default session snapshot
    mockGetSessionRequestSnapshot.mockResolvedValue({ messageCount: 0, tokensUsed: 0 });
    mockPersistMessages.mockResolvedValue(undefined);
    mockGetRecentMessagesForContext.mockResolvedValue([]);
    mockBuildSystemPrompt.mockResolvedValue("system");
    mockGetRecruitmentTools.mockReturnValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.CHAT_MAX_TOKENS_PER_SESSION;
  });

  async function importRoute() {
    // Mock streamText at the ai-models level to return a stub result
    const streamResult = {
      toUIMessageStreamResponse: vi.fn(() => new Response("stream", { status: 200 })),
      usage: Promise.resolve({ promptTokens: 10, completionTokens: 5 }),
      // biome-ignore lint/suspicious/noThenProperty: route uses void Promise.resolve(result).then(...)
      then: (resolve: (v: unknown) => void) => Promise.resolve(streamResult).then(resolve),
    };

    vi.doMock("@/src/lib/ai-models", () => ({
      resolveChatModel: vi.fn(() => "mock-model"),
      tracedStreamText: vi.fn(() => streamResult),
      tracedGenerateObject: vi.fn(() => Promise.resolve({ object: { title: "Test titel" } })),
    }));

    const mod = await import("@/app/api/chat/route");
    POST = mod.POST;
  }

  it("returns 429 with Retry-After header when rate limit is exceeded", async () => {
    const resetTime = Date.now() + 30_000;
    mockRateLimitCheck.mockReturnValue({
      success: false,
      remaining: 0,
      reset: resetTime,
    });

    await importRoute();

    const req = makeRequest({
      messages: [userMessage("Hallo")],
    });
    const res = await POST(req);

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("Te veel verzoeken. Probeer het later opnieuw.");
    expect(res.headers.get("Retry-After")).toBeDefined();
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("returns 400 when messages array is empty", async () => {
    await importRoute();

    const req = makeRequest({ messages: [] });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Ongeldige aanvraag");
  });

  it("returns 400 when body has no messages", async () => {
    await importRoute();

    const req = makeRequest({});
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Ongeldige aanvraag");
  });

  it("returns 400 when context is invalid", async () => {
    await importRoute();

    const req = makeRequest({
      messages: [userMessage("Hallo")],
      context: { entityId: "not-a-uuid" },
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Ongeldige context");
  });

  it("returns 429 with Dutch error when token budget is exceeded", async () => {
    process.env.CHAT_MAX_TOKENS_PER_SESSION = "1000";

    mockGetSessionRequestSnapshot.mockResolvedValue({
      messageCount: 50,
      tokensUsed: 1500,
    });

    await importRoute();

    const req = makeRequest({
      messages: [userMessage("Nog een vraag")],
      context: { sessionId: "sess-budget-test" },
    });
    const res = await POST(req);

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe(
      "Je sessie heeft het tokenbudget bereikt. Start een nieuw gesprek om verder te gaan.",
    );
  });

  it("returns 429 when session snapshot load fails and token budget is configured", async () => {
    process.env.CHAT_MAX_TOKENS_PER_SESSION = "1000";

    mockGetSessionRequestSnapshot.mockRejectedValue(new Error("DB down"));

    await importRoute();

    const req = makeRequest({
      messages: [userMessage("Nog een vraag")],
      context: { sessionId: "sess-fail-test" },
    });
    const res = await POST(req);

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe(
      "Je sessie heeft het tokenbudget bereikt. Start een nieuw gesprek om verder te gaan.",
    );
  });
});
