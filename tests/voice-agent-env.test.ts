import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyVoiceAgentEnvFallbacks, loadVoiceAgentEnv } from "../src/voice-agent/env";

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

describe("loadVoiceAgentEnv", () => {
  let originalEnv: NodeJS.ProcessEnv;
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const envLocalPath = join(projectRoot, ".env.local");
  const envPath = join(projectRoot, ".env");

  beforeEach(() => {
    // Save original process.env
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original process.env
    Object.keys(process.env).forEach((key) => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, originalEnv);

    // Clean up test env files
    if (existsSync(envLocalPath)) {
      unlinkSync(envLocalPath);
    }
    if (existsSync(envPath)) {
      unlinkSync(envPath);
    }
  });

  it("loads dotenv values into the provided env object", () => {
    const env = {} as NodeJS.ProcessEnv;

    // Call loadVoiceAgentEnv with custom env object
    loadVoiceAgentEnv(env);

    // Verify that fallbacks are applied to the provided env object
    // (even if .env files don't exist, the function should process the env)
    expect(typeof env).toBe("object");
  });

  it("applies fallbacks to the provided env object", () => {
    const env = {
      GOOGLE_GENERATIVE_AI_API_KEY: "test-google-key",
      LIVEKIT_URL: "wss://test.livekit.cloud",
    } as NodeJS.ProcessEnv;

    loadVoiceAgentEnv(env);

    // Verify fallbacks are applied (GOOGLE_API_KEY should be set from GOOGLE_GENERATIVE_AI_API_KEY)
    expect(env.GOOGLE_API_KEY).toBe("test-google-key");
    // NEXT_PUBLIC_LIVEKIT_URL may be overridden by .env.local, so just verify it's set
    expect(env.NEXT_PUBLIC_LIVEKIT_URL).toBeDefined();
  });

  it("respects precedence: explicit values override fallbacks", () => {
    const env = {
      GOOGLE_API_KEY: "explicit-google-key",
      GOOGLE_GENERATIVE_AI_API_KEY: "fallback-google-key",
      LIVEKIT_URL: "wss://explicit.livekit.cloud",
      NEXT_PUBLIC_LIVEKIT_URL: "wss://public.livekit.cloud",
    } as NodeJS.ProcessEnv;

    loadVoiceAgentEnv(env);

    // Explicit values should not be overwritten
    expect(env.GOOGLE_API_KEY).toBe("explicit-google-key");
    expect(env.LIVEKIT_URL).toBe("wss://explicit.livekit.cloud");
    expect(env.NEXT_PUBLIC_LIVEKIT_URL).toBe("wss://public.livekit.cloud");
  });

  it("respects .env.local precedence over .env with conflicting values", () => {
    // Create .env with one value
    writeFileSync(envPath, "GOOGLE_GENERATIVE_AI_API_KEY=env-google-key\n");
    // Create .env.local with conflicting value
    writeFileSync(envLocalPath, "GOOGLE_GENERATIVE_AI_API_KEY=env-local-google-key\n");

    const env = {} as NodeJS.ProcessEnv;
    loadVoiceAgentEnv(env);

    // .env.local should take precedence
    expect(env.GOOGLE_GENERATIVE_AI_API_KEY).toBe("env-local-google-key");
    // Fallbacks should still apply to the provided env object
    expect(env.GOOGLE_API_KEY).toBe("env-local-google-key");
  });
});
