import { createRequire } from "node:module";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { xai } from "@ai-sdk/xai";
import * as ai from "ai";

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
export const gemini31FlashLite = google("gemini-3.1-flash-lite-preview");
export const geminiFlashLite = google("gemini-2.5-flash-lite");
export const geminiFlash = google("gemini-3-flash-preview");
export const grok = xai("grok-4-1-fast-reasoning");
export const gpt5Nano = openai("gpt-5-nano-2025-08-07");
export const embeddingModel = openai.textEmbeddingModel("text-embedding-3-small");

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

/** LangSmith-traced `generateText` — falls back to raw `ai.generateText` */
export function tracedGenerateText(
  ...args: Parameters<typeof ai.generateText>
): ReturnType<typeof ai.generateText> {
  return getTraced().generateText(...args);
}

/** LangSmith-traced `generateObject` — falls back to raw `ai.generateObject` */
export function tracedGenerateObject<T>(
  ...args: Parameters<typeof ai.generateObject<T>>
): ReturnType<typeof ai.generateObject<T>> {
  return getTraced().generateObject<T>(...(args as Parameters<typeof ai.generateObject<T>>));
}

/** LangSmith-traced `streamText` — falls back to raw `ai.streamText` */
export function tracedStreamText(
  ...args: Parameters<typeof ai.streamText>
): ReturnType<typeof ai.streamText> {
  return getTraced().streamText(...args);
}

/** LangSmith-traced `embed` — falls back to raw `ai.embed` */
export function tracedEmbed(...args: Parameters<typeof ai.embed>): ReturnType<typeof ai.embed> {
  return getTraced().embed(...args);
}

/** LangSmith-traced `embedMany` — falls back to raw `ai.embedMany` */
export function tracedEmbedMany(
  ...args: Parameters<typeof ai.embedMany>
): ReturnType<typeof ai.embedMany> {
  return getTraced().embedMany(...args);
}
