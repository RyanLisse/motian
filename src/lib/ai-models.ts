import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { xai } from "@ai-sdk/xai";
import * as ai from "ai";

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
// generateText, streamText, embed, embedMany with OpenTelemetry traces.
// Gracefully falls back to raw `ai` functions when LANGCHAIN_API_KEY is absent.

type WrappedAI = {
  generateText: typeof ai.generateText;
  streamText: typeof ai.streamText;
  embed: typeof ai.embed;
  embedMany: typeof ai.embedMany;
};

let _traced: WrappedAI | undefined;

function getTraced(): WrappedAI {
  if (_traced) return _traced;

  if (!process.env.LANGCHAIN_API_KEY) {
    _traced = {
      generateText: ai.generateText,
      streamText: ai.streamText,
      embed: ai.embed,
      embedMany: ai.embedMany,
    };
    return _traced;
  }

  try {
    // Dynamic require to avoid build-time resolution of optional subpath.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { wrapAISDK } = require("langsmith/experimental/vercel") as {
      wrapAISDK: (mod: typeof ai) => typeof ai;
    };
    const wrapped = wrapAISDK(ai);
    _traced = {
      generateText: wrapped.generateText,
      streamText: wrapped.streamText,
      embed: wrapped.embed,
      embedMany: wrapped.embedMany,
    };
  } catch {
    _traced = {
      generateText: ai.generateText,
      streamText: ai.streamText,
      embed: ai.embed,
      embedMany: ai.embedMany,
    };
  }

  return _traced;
}

/** LangSmith-traced `generateText` — falls back to raw `ai.generateText` */
export function tracedGenerateText(
  ...args: Parameters<typeof ai.generateText>
): ReturnType<typeof ai.generateText> {
  return getTraced().generateText(...args);
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
