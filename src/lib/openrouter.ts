/**
 * OpenRouter AI Configuration
 *
 * Unified AI provider for Motian — routes all AI calls through OpenRouter
 * for simplified API management, automatic fallbacks, and unified billing.
 *
 * Migration from: OpenAI, Google, xAI direct APIs
 * Benefits: One API key, automatic model routing, unified rate limits
 *
 * @see https://openrouter.ai/docs
 */

import { createOpenAI } from "@ai-sdk/openai";
import { google as googleDirect } from "@ai-sdk/google";

// Check if we should use OpenRouter (fallback to direct for development)
const USE_OPENROUTER = process.env.USE_OPENROUTER !== "false";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (USE_OPENROUTER && !OPENROUTER_API_KEY) {
  throw new Error(
    "OPENROUTER_API_KEY is required when USE_OPENROUTER is enabled. " +
      "Set OPENROUTER_API_KEY in your .env.local or disable with USE_OPENROUTER=false"
  );
}

// Create OpenRouter client with AI SDK OpenAI compatibility
const openrouter = USE_OPENROUTER
  ? createOpenAI({
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: OPENROUTER_API_KEY!,
      headers: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://motian.vercel.app",
        "X-Title": "Motian Recruitment Platform",
      },
    })
  : null;

// Fallback to direct Google for voice agent (Native Audio compatibility)
const google = googleDirect;

// ═══════════════════════════════════════════════════════════════════════════
// MODEL DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Chat models for recruitment agent conversations
 * Primary: Fast, cost-effective for most operations
 * Advanced: Higher quality for complex reasoning
 */
export const chatModels = {
  // GPT-5 Nano — primary chat model (fast, cheap, good tools)
  nano: openrouter!("openai/gpt-5-nano"),
  // GPT-5.4 — advanced model for complex matching/analysis
  advanced: openrouter!("openai/gpt-5.4"),
  // Fallback: Gemini Flash Lite (if OpenRouter routes to it)
  fallback: openrouter!("google/gemini-2.5-flash-lite"),
};

/**
 * Multimodal models for CV parsing and vision tasks
 * Supports PDF, image, and text inputs
 */
export const multimodalModels = {
  // Gemini 3 Flash — primary CV parser
  cvParse: openrouter!("google/gemini-3-flash"),
  // Advanced CV parsing with higher accuracy
  cvParseAdvanced: openrouter!("google/gemini-3.1-flash"),
  // Vision model for document understanding
  vision: openrouter!("openai/gpt-5.4"),
};

/**
 * Judge models for independent match evaluation
 * Provides second opinion on matching decisions
 */
export const judgeModels = {
  // Grok 4 — independent verdict model
  grok: openrouter!("xai/grok-4"),
  // Claude Sonnet — alternative judge
  claude: openrouter!("anthropic/claude-sonnet-4-6"),
};

/**
 * Embedding models for vector search
 * Used for job/candidate semantic matching
 */
export const embeddingModels = {
  // OpenAI text-embedding-3-small — 1536 dimensions
  openai: openrouter!.textEmbeddingModel("openai/text-embedding-3-small"),
  // Alternative: Mistral embeddings (check availability)
  // mistral: openrouter!.textEmbeddingModel("mistral/mistral-embed"),
};

/**
 * Voice models — NOTE: Native audio still via direct Google
 * OpenRouter audio output is experimental for real-time voice
 */
export const voiceModels = {
  // Direct Google for LiveKit native audio streaming
  native: google("gemini-2.5-flash"),
  // OpenRouter fallback (higher latency, test first)
  openrouter: openrouter?.("google/gemini-2.5-flash"),
};

// ═══════════════════════════════════════════════════════════════════════════
// BACKWARD COMPATIBILITY EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

// Keep existing exports for gradual migration
export const gemini31FlashLite = chatModels.fallback;
export const geminiFlashLite = chatModels.fallback;
export const geminiFlash = multimodalModels.cvParse;
export const grok = judgeModels.grok;
export const gpt5Nano = chatModels.nano;
export const embeddingModel = embeddingModels.openai;

// ═══════════════════════════════════════════════════════════════════════════
// MODEL REGISTRY (for UI picker)
// ═══════════════════════════════════════════════════════════════════════════

export const CHAT_MODELS = {
  "gpt-5-nano": {
    model: chatModels.nano,
    label: "GPT-5 Nano",
    provider: "OpenRouter → OpenAI",
    description: "Fast, cost-effective for most tasks",
  },
  "gpt-5.4": {
    model: chatModels.advanced,
    label: "GPT-5.4",
    provider: "OpenRouter → OpenAI",
    description: "Advanced reasoning for complex matches",
  },
  "gemini-3.1-flash-lite": {
    model: chatModels.fallback,
    label: "Gemini 3.1 Flash Lite",
    provider: "OpenRouter → Google",
    description: "Fallback option, good multilingual support",
  },
  "grok-4": {
    model: judgeModels.grok,
    label: "Grok 4",
    provider: "OpenRouter → xAI",
    description: "Independent evaluation, good for judging",
  },
  "claude-sonnet-4-6": {
    model: judgeModels.claude,
    label: "Claude Sonnet 4.6",
    provider: "OpenRouter → Anthropic",
    description: "High-quality reasoning alternative",
  },
} as const;

export type ChatModelId = keyof typeof CHAT_MODELS;
export const DEFAULT_CHAT_MODEL: ChatModelId = "gpt-5-nano";

export function resolveChatModel(id?: string) {
  if (id && id in CHAT_MODELS) return CHAT_MODELS[id as ChatModelId].model;
  return CHAT_MODELS[DEFAULT_CHAT_MODEL].model;
}

// ═══════════════════════════════════════════════════════════════════════════
// FALLBACK CHAIN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Automatic fallback models if primary fails
 * OpenRouter handles most of this, but explicit fallback helps
 */
export const FALLBACK_CHAIN = [
  "openai/gpt-5-nano",
  "openai/gpt-5.4",
  "google/gemini-2.5-flash-lite",
  "anthropic/claude-sonnet-4-6",
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// COST TRACKING (for analytics)
// ═══════════════════════════════════════════════════════════════════════════

export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "openai/gpt-5-nano": { input: 0.0001, output: 0.0004 }, // $0.10/1M tokens
  "openai/gpt-5.4": { input: 0.002, output: 0.008 }, // $2/1M tokens
  "google/gemini-3-flash": { input: 0.00035, output: 0.0014 }, // $0.35/1M tokens
  "xai/grok-4": { input: 0.005, output: 0.015 }, // $5/1M tokens
  "anthropic/claude-sonnet-4-6": { input: 0.003, output: 0.015 },
  "openai/text-embedding-3-small": { input: 0.00002, output: 0 }, // $0.02/1M tokens
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get model by OpenRouter ID string
 * Useful for dynamic model selection
 */
export function getModelById(modelId: string) {
  if (!openrouter) return null;
  return openrouter(modelId);
}

/**
 * Check if voice should use direct Google or OpenRouter
 * Returns true if OpenRouter voice is ready for production
 */
export function shouldUseOpenRouterVoice(): boolean {
  // Voice via OpenRouter is experimental — keep direct for now
  // Set OPENROUTER_VOICE_ENABLED=true to test
  return process.env.OPENROUTER_VOICE_ENABLED === "true";
}
