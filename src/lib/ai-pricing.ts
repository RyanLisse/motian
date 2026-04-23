/**
 * Per-million-token USD pricing for every model used in this repo.
 *
 * Source: provider published rate cards (Google AI, OpenAI, xAI) — April 2026.
 * These are a point-in-time snapshot; when a provider changes its rate, update
 * here and consider backfilling `ai_usage.costUsdMicros` only if you need
 * historical accuracy (we don't — we report at recorded cost).
 *
 * When a model is not in the table, we record tokens but cost=0 and log a
 * warning so the gap is visible instead of silently estimating.
 */

export type ModelPricing = {
  provider: string;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
};

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Google
  "gemini-3.1-flash-lite-preview": {
    provider: "google",
    inputUsdPerMillion: 0.1,
    outputUsdPerMillion: 0.4,
  },
  "gemini-2.5-flash-lite": {
    provider: "google",
    inputUsdPerMillion: 0.1,
    outputUsdPerMillion: 0.4,
  },
  "gemini-3-flash-preview": {
    provider: "google",
    inputUsdPerMillion: 0.3,
    outputUsdPerMillion: 2.5,
  },
  // OpenAI
  "gpt-5-nano-2025-08-07": {
    provider: "openai",
    inputUsdPerMillion: 0.05,
    outputUsdPerMillion: 0.4,
  },
  "text-embedding-3-small": {
    provider: "openai",
    inputUsdPerMillion: 0.02,
    outputUsdPerMillion: 0,
  },
  // xAI
  "grok-4-1-fast-reasoning": {
    provider: "xai",
    inputUsdPerMillion: 0.2,
    outputUsdPerMillion: 1.5,
  },
};

/**
 * Compute cost in micro-dollars (USD × 1_000_000) for a given model + token
 * usage. Returns 0 (with the resolved provider="unknown") when the model
 * isn't in the pricing table — caller is expected to log the miss.
 */
export function computeCostMicros(
  model: string,
  inputTokens: number,
  outputTokens: number,
): { provider: string; costMicros: number; known: boolean } {
  const price = MODEL_PRICING[model];
  if (!price) return { provider: "unknown", costMicros: 0, known: false };
  const usd =
    (inputTokens / 1_000_000) * price.inputUsdPerMillion +
    (outputTokens / 1_000_000) * price.outputUsdPerMillion;
  return {
    provider: price.provider,
    costMicros: Math.round(usd * 1_000_000),
    known: true,
  };
}
