import { describe, expect, it } from "vitest";
import {
  isProductionEnvironment,
  shouldAllowMissingApiSecret,
  validateRuntimeEnv,
} from "@/src/lib/runtime-config";

describe("runtime-config validation", () => {
  it("requires API_SECRET in production", () => {
    const result = validateRuntimeEnv({
      DATABASE_URL: "postgres://example",
      NODE_ENV: "production",
      VERCEL_ENV: "production",
    });

    expect(result.errors).toContain(
      "API_SECRET is verplicht in productie om beschermde /api-routes af te schermen.",
    );
    expect(result.errors).not.toContain(
      "SESSION_SECRET is verplicht in productie om de operator-sessiecookie te ondertekenen.",
    );
    expect(result.errors).not.toContain(
      "OPERATOR_PASSWORD_HASH is verplicht in productie; zonder deze waarde kan niemand inloggen.",
    );
    expect(shouldAllowMissingApiSecret({ NODE_ENV: "production", VERCEL_ENV: "production" })).toBe(
      false,
    );
  });

  it("allows missing API_SECRET outside production", () => {
    const result = validateRuntimeEnv({
      DATABASE_URL: "postgres://example",
      NODE_ENV: "test",
    });

    expect(result.errors).not.toContain(
      "API_SECRET is verplicht in productie om beschermde /api-routes af te schermen.",
    );
    expect(shouldAllowMissingApiSecret({ NODE_ENV: "test" })).toBe(true);
    expect(isProductionEnvironment({ NODE_ENV: "production", VERCEL_ENV: "preview" })).toBe(false);
  });

  it("requires a complete voice env set once LiveKit is configured", () => {
    const result = validateRuntimeEnv({
      DATABASE_URL: "postgres://example",
      NEXT_PUBLIC_LIVEKIT_URL: "wss://example.livekit.cloud",
      LIVEKIT_API_KEY: "key",
    });

    expect(result.errors).toEqual([
      "Voice-configuratie is onvolledig: LIVEKIT_URL, LIVEKIT_API_SECRET.",
    ]);
  });

  it("accepts a complete LiveKit env set without direct provider keys", () => {
    const result = validateRuntimeEnv({
      DATABASE_URL: "postgres://example",
      NEXT_PUBLIC_LIVEKIT_URL: "wss://public.livekit.cloud",
      LIVEKIT_URL: "wss://internal.livekit.cloud",
      LIVEKIT_API_KEY: "key",
      LIVEKIT_API_SECRET: "secret",
    });

    expect(result.errors).toEqual([]);
  });
});
