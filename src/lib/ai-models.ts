import { createRequire } from "node:module";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import * as ai from "ai";

// ── OpenRouter provider ─────────────────────────────────────────────
// All LLM calls (chat + embeddings) flow through OpenRouter so we have a
// single key, single billing surface, and easy per-call model swapping.
// `apiKey` is read lazily from env so test mocks can stub the module
// without `OPENROUTER_API_KEY` being set.
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
});

type EnvMap = Record<string, string | undefined>;

function hasNonEmptyValue(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function pickFirstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find(hasNonEmptyValue);
}

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (!hasNonEmptyValue(value)) return undefined;

  switch (value.trim().toLowerCase()) {
    case "1":
    case "true":
    case "yes":
    case "on":
      return true;
    case "0":
    case "false":
    case "no":
    case "off":
      return false;
    default:
      return undefined;
  }
}

export function applyLangSmithEnvFallbacks(env: EnvMap = process.env): EnvMap {
  env.LANGSMITH_TRACING ??= env.LANGCHAIN_TRACING_V2;
  env.LANGSMITH_API_KEY ??= env.LANGCHAIN_API_KEY;
  env.LANGSMITH_PROJECT ??= env.LANGCHAIN_PROJECT;
  return env;
}

export function getLangSmithApiKey(env: EnvMap = process.env): string | undefined {
  return pickFirstNonEmpty(env.LANGSMITH_API_KEY, env.LANGCHAIN_API_KEY);
}

export function getLangSmithProject(env: EnvMap = process.env): string | undefined {
  return pickFirstNonEmpty(env.LANGSMITH_PROJECT, env.LANGCHAIN_PROJECT);
}

export function isLangSmithTracingEnabled(env: EnvMap = process.env): boolean {
  const tracingPreference =
    parseBooleanEnv(env.LANGSMITH_TRACING) ?? parseBooleanEnv(env.LANGCHAIN_TRACING_V2);

  if (!getLangSmithApiKey(env)) {
    return false;
  }

  return tracingPreference ?? true;
}

// ── Centralized model instances ─────────────────────────────────────
// Model IDs use OpenRouter's `<vendor>/<model>` slug format.
// See https://openrouter.ai/models for the live catalog.
export const gemini31FlashLite = openrouter("google/gemini-3.1-flash-lite-preview");
export const geminiFlashLite = openrouter("google/gemini-2.5-flash-lite");
export const geminiFlash = openrouter("google/gemini-3-flash-preview");
export const grok = openrouter("x-ai/grok-4");
export const gpt5Nano = openrouter("openai/gpt-5-nano");
// Pgvector columns are 512-dim (see packages/db/src/schema.ts vector("embedding",
// { dimensions: 512 })). text-embedding-3-small defaults to 1536, so we must
// request the 512-dim Matryoshka projection at the embeddings endpoint.
// OpenRouter's typed settings don't expose `extraBody` publicly, but the
// runtime spreads `settings.extraBody` into the POST body — see
// node_modules/@openrouter/ai-sdk-provider/dist/index.js doEmbed.
export const embeddingModel = openrouter.textEmbeddingModel("openai/text-embedding-3-small", {
  extraBody: { dimensions: 512 },
} as Parameters<typeof openrouter.textEmbeddingModel>[1]);

// ── Chat model registry (for model picker) ─────────────────────────
export const CHAT_MODELS = {
  "gemini-3.1-flash-lite": {
    model: gemini31FlashLite,
    label: "Gemini 3.1 Flash Lite",
    provider: "Google",
  },
  "gemini-3-flash": { model: geminiFlash, label: "Gemini 3 Flash", provider: "Google" },
  "gemini-2.5-flash-lite": {
    model: geminiFlashLite,
    label: "Gemini 2.5 Flash Lite",
    provider: "Google",
  },
  "gpt-5-nano": { model: gpt5Nano, label: "GPT-5 Nano", provider: "OpenAI" },
  "grok-4": { model: grok, label: "Grok 4", provider: "xAI" },
} as const;

export type ChatModelId = keyof typeof CHAT_MODELS;
export const DEFAULT_CHAT_MODEL: ChatModelId = "gemini-3.1-flash-lite";

export function resolveChatModel(id?: string) {
  if (id && id in CHAT_MODELS) return CHAT_MODELS[id as ChatModelId].model;
  return CHAT_MODELS[DEFAULT_CHAT_MODEL].model;
}

// ── LangSmith-traced AI SDK functions ───────────────────────────────
// Uses `wrapAISDK` from `langsmith/experimental/vercel` to instrument
// generateText, generateObject, streamText, embed, embedMany with OpenTelemetry traces.
// Prefers official LANGSMITH_* env vars while preserving legacy LANGCHAIN_* compatibility.
// Gracefully falls back to raw `ai` functions when tracing is disabled or unavailable.

type WrappedAI = {
  generateText: typeof ai.generateText;
  generateObject: typeof ai.generateObject;
  streamText: typeof ai.streamText;
  embed: typeof ai.embed;
  embedMany: typeof ai.embedMany;
};

let _traced: WrappedAI | undefined;
const langsmithRequire = createRequire(import.meta.url);

function getRawAI(): WrappedAI {
  return {
    generateText: ai.generateText,
    generateObject: ai.generateObject,
    streamText: ai.streamText,
    embed: ai.embed,
    embedMany: ai.embedMany,
  };
}

function getTraced(): WrappedAI {
  if (_traced) return _traced;

  applyLangSmithEnvFallbacks();

  if (!isLangSmithTracingEnabled()) {
    _traced = getRawAI();
    return _traced;
  }

  try {
    const { wrapAISDK } = langsmithRequire("langsmith/experimental/vercel") as {
      wrapAISDK: (mod: typeof ai) => typeof ai;
    };
    const wrapped = wrapAISDK(ai);
    _traced = {
      generateText: wrapped.generateText,
      generateObject: wrapped.generateObject,
      streamText: wrapped.streamText,
      embed: wrapped.embed,
      embedMany: wrapped.embedMany,
    };
  } catch {
    _traced = getRawAI();
  }

  return _traced;
}

// Lazy import of the usage recorder so this module stays importable in
// environments without DB bindings (tests, edge runtime experiments, etc.).
function lazyRecord(flow: string, resultPromise: Promise<unknown>): void {
  void import("../services/ai-usage")
    .then(({ recordFromResult }) => {
      recordFromResult(flow, resultPromise);
    })
    .catch(() => {});
}

/** LangSmith-traced `generateText` — falls back to raw `ai.generateText` */
export function tracedGenerateText(
  ...args: Parameters<typeof ai.generateText>
): ReturnType<typeof ai.generateText> {
  const p = getTraced().generateText(...args);
  lazyRecord("generateText", p);
  return p;
}

/** LangSmith-traced `generateObject` — falls back to raw `ai.generateObject` */
export const tracedGenerateObject: typeof ai.generateObject = (...args) => {
  const p = getTraced().generateObject(...args);
  lazyRecord("generateObject", p);
  return p;
};

/** LangSmith-traced `streamText` — falls back to raw `ai.streamText` */
export function tracedStreamText(
  ...args: Parameters<typeof ai.streamText>
): ReturnType<typeof ai.streamText> {
  const result = getTraced().streamText(...args);
  // streamText is synchronous-returning; usage is resolved on `result.usage`
  // (Promise) after the stream finishes. Forward that to the recorder.
  const bag = result as unknown as {
    usage?: Promise<unknown>;
    response?: Promise<{ modelId?: string }>;
    modelId?: string;
  };
  const usagePromise = bag.usage;
  if (usagePromise && typeof usagePromise.then === "function") {
    void import("../services/ai-usage")
      .then(async ({ recordAiUsage }) => {
        const u = (await usagePromise) as {
          inputTokens?: number;
          outputTokens?: number;
          totalTokens?: number;
          promptTokens?: number;
          completionTokens?: number;
        };
        let modelId: string | undefined = bag.modelId;
        if (!modelId && bag.response && typeof bag.response.then === "function") {
          modelId = await bag.response.then((r) => r?.modelId).catch(() => undefined);
        }
        await recordAiUsage({
          flow: "streamText",
          model: modelId ?? "unknown",
          inputTokens: u.inputTokens ?? u.promptTokens ?? 0,
          outputTokens: u.outputTokens ?? u.completionTokens ?? 0,
          totalTokens: u.totalTokens,
        });
      })
      .catch(() => {});
  }
  return result;
}

/** LangSmith-traced `embed` — falls back to raw `ai.embed` */
export function tracedEmbed(...args: Parameters<typeof ai.embed>): ReturnType<typeof ai.embed> {
  const p = getTraced().embed(...args);
  lazyRecord("embed", p);
  return p;
}

/** LangSmith-traced `embedMany` — falls back to raw `ai.embedMany` */
export function tracedEmbedMany(
  ...args: Parameters<typeof ai.embedMany>
): ReturnType<typeof ai.embedMany> {
  const p = getTraced().embedMany(...args);
  lazyRecord("embedMany", p);
  return p;
}
