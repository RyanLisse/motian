import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { xai } from "@ai-sdk/xai";
import { wrapAISDKModel } from "langsmith/wrappers/vercel";

function maybeWrap<TModel>(model: TModel): TModel {
  if (!process.env.LANGCHAIN_API_KEY) {
    return model;
  }

  return wrapAISDKModel(model);
}

export const geminiFlashLite = maybeWrap(google("gemini-2.5-flash-lite"));
export const geminiFlash = maybeWrap(google("gemini-3-flash-preview"));
export const grok = maybeWrap(xai("grok-4-1-fast-reasoning"));
export const gpt5Nano = maybeWrap(openai("gpt-5-nano-2025-08-07"));
export const embeddingModel = openai.textEmbeddingModel("text-embedding-3-small");
