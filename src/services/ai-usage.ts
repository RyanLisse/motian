import { db } from "../db";
import { aiUsage } from "../db/schema";
import { computeCostMicros } from "../lib/ai-pricing";

/**
 * Fire-and-forget insert for a single AI SDK call. Never throws — if the DB
 * write fails, we log and move on so a failing usage ledger can't break a
 * user-facing AI response.
 */
export async function recordAiUsage(input: {
  flow: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { flow, model, inputTokens, outputTokens, metadata } = input;
    const total = input.totalTokens ?? inputTokens + outputTokens;
    if (total <= 0) return;

    const { provider, costMicros, known } = computeCostMicros(model, inputTokens, outputTokens);
    if (!known) {
      console.warn(
        `[ai-usage] no pricing for model="${model}" — recording tokens but costUsdMicros=0`,
      );
    }

    await db.insert(aiUsage).values({
      flow,
      provider,
      model,
      inputTokens,
      outputTokens,
      totalTokens: total,
      costUsdMicros: costMicros,
      metadata: metadata ?? {},
    });
  } catch (err) {
    console.error("[ai-usage] insert failed:", err);
  }
}

/**
 * Best-effort extraction of token usage + model id from an AI SDK v6 result.
 * Supports generateText, generateObject, streamText (awaited), embed, embedMany.
 * Returns `null` when the result shape isn't recognised.
 */
export function extractUsageFromResult(
  result: unknown,
): { model?: string; inputTokens: number; outputTokens: number; totalTokens?: number } | null {
  if (!result || typeof result !== "object") return null;
  const r = result as {
    usage?: {
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
      promptTokens?: number;
      completionTokens?: number;
    };
    response?: { modelId?: string };
    modelId?: string;
  };
  if (!r.usage) return null;
  const inputTokens = r.usage.inputTokens ?? r.usage.promptTokens ?? 0;
  const outputTokens = r.usage.outputTokens ?? r.usage.completionTokens ?? 0;
  const totalTokens = r.usage.totalTokens;
  if (inputTokens === 0 && outputTokens === 0 && !totalTokens) return null;
  return {
    model: r.response?.modelId ?? r.modelId,
    inputTokens,
    outputTokens,
    totalTokens,
  };
}

/**
 * Convenience: wrap an AI SDK result promise, extract usage when it settles,
 * and record it under the given flow. Never awaits on the caller's path —
 * the ledger insert happens in the background.
 */
export function recordFromResult(
  flow: string,
  resultPromise: Promise<unknown>,
  options?: { model?: string; metadata?: Record<string, unknown> },
): void {
  void Promise.resolve(resultPromise)
    .then(async (result) => {
      const extracted = extractUsageFromResult(result);
      if (!extracted) return;
      await recordAiUsage({
        flow,
        model: options?.model ?? extracted.model ?? "unknown",
        inputTokens: extracted.inputTokens,
        outputTokens: extracted.outputTokens,
        totalTokens: extracted.totalTokens,
        metadata: options?.metadata,
      });
    })
    .catch((err) => {
      console.error("[ai-usage] recordFromResult failed:", err);
    });
}
