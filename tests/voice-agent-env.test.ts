import { describe, expect, it } from "vitest";
import { applyVoiceAgentEnvFallbacks } from "../src/voice-agent/env";

describe("voice agent env fallbacks", () => {
  it("maps repo Gemini and LiveKit env conventions to the worker runtime", () => {
    const env = {
      GOOGLE_GENERATIVE_AI_API_KEY: "google-fallback-key",
      LIVEKIT_URL: "wss://motian.livekit.cloud",
    } as NodeJS.ProcessEnv;

    applyVoiceAgentEnvFallbacks(env);

    expect(env.GOOGLE_API_KEY).toBe("google-fallback-key");
    expect(env.NEXT_PUBLIC_LIVEKIT_URL).toBe("wss://motian.livekit.cloud");
  });

  it("does not overwrite explicitly configured worker env vars", () => {
    const env = {
      GOOGLE_API_KEY: "preferred-google-key",
      GOOGLE_GENERATIVE_AI_API_KEY: "fallback-google-key",
      LIVEKIT_URL: "wss://worker.livekit.cloud",
      NEXT_PUBLIC_LIVEKIT_URL: "wss://public.livekit.cloud",
    } as NodeJS.ProcessEnv;

    applyVoiceAgentEnvFallbacks(env);

    expect(env.GOOGLE_API_KEY).toBe("preferred-google-key");
    expect(env.LIVEKIT_URL).toBe("wss://worker.livekit.cloud");
    expect(env.NEXT_PUBLIC_LIVEKIT_URL).toBe("wss://public.livekit.cloud");
  });
});
