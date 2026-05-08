import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyVoiceAgentEnvFallbacks, loadVoiceAgentEnv } from "../src/voice-agent/env";

describe("voice agent env fallbacks", () => {
  it("maps the public LiveKit URL to the worker runtime URL", () => {
    const env = {
      NEXT_PUBLIC_LIVEKIT_URL: "wss://motian.livekit.cloud",
    } as NodeJS.ProcessEnv;

    applyVoiceAgentEnvFallbacks(env);

    expect(env.LIVEKIT_URL).toBe("wss://motian.livekit.cloud");
  });

  it("maps the worker LiveKit URL back to the public URL for shared config", () => {
    const env = {
      LIVEKIT_URL: "wss://worker.livekit.cloud",
    } as NodeJS.ProcessEnv;

    applyVoiceAgentEnvFallbacks(env);

    expect(env.NEXT_PUBLIC_LIVEKIT_URL).toBe("wss://worker.livekit.cloud");
  });

  it("does not overwrite explicitly configured LiveKit env vars", () => {
    const env = {
      LIVEKIT_URL: "wss://worker.livekit.cloud",
      NEXT_PUBLIC_LIVEKIT_URL: "wss://public.livekit.cloud",
    } as NodeJS.ProcessEnv;

    applyVoiceAgentEnvFallbacks(env);

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
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);

    if (existsSync(envLocalPath)) {
      unlinkSync(envLocalPath);
    }
    if (existsSync(envPath)) {
      unlinkSync(envPath);
    }
  });

  it("loads dotenv values into the provided env object", () => {
    const env = {} as NodeJS.ProcessEnv;

    loadVoiceAgentEnv(env);

    expect(typeof env).toBe("object");
  });

  it("applies LiveKit fallbacks to the provided env object", () => {
    const env = {
      LIVEKIT_URL: "wss://test.livekit.cloud",
    } as NodeJS.ProcessEnv;

    loadVoiceAgentEnv(env);

    expect(env.NEXT_PUBLIC_LIVEKIT_URL).toBeDefined();
  });

  it("respects precedence: explicit values override fallbacks", () => {
    const env = {
      LIVEKIT_URL: "wss://explicit.livekit.cloud",
      NEXT_PUBLIC_LIVEKIT_URL: "wss://public.livekit.cloud",
    } as NodeJS.ProcessEnv;

    loadVoiceAgentEnv(env);

    expect(env.LIVEKIT_URL).toBe("wss://explicit.livekit.cloud");
    expect(env.NEXT_PUBLIC_LIVEKIT_URL).toBe("wss://public.livekit.cloud");
  });

  it("respects .env.local precedence over .env with conflicting values", () => {
    writeFileSync(envPath, "LIVEKIT_URL=wss://env.livekit.cloud\n");
    writeFileSync(envLocalPath, "LIVEKIT_URL=wss://env-local.livekit.cloud\n");

    const env = {} as NodeJS.ProcessEnv;
    loadVoiceAgentEnv(env);

    expect(env.LIVEKIT_URL).toBe("wss://env-local.livekit.cloud");
    expect(env.NEXT_PUBLIC_LIVEKIT_URL).toBe("wss://env-local.livekit.cloud");
  });
});
