import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLiveKitConfigStatus,
  getLiveKitServerConfig,
  LIVEKIT_UNCONFIGURED_ERROR,
} from "../src/lib/livekit";

const ORIGINAL_ENV = {
  LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
  LIVEKIT_URL: process.env.LIVEKIT_URL,
  NEXT_PUBLIC_LIVEKIT_URL: process.env.NEXT_PUBLIC_LIVEKIT_URL,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }
}

describe("LiveKit config helpers", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("prefers LIVEKIT_URL when both url env vars are present", () => {
    const config = getLiveKitServerConfig({
      LIVEKIT_API_KEY: "key",
      LIVEKIT_API_SECRET: "secret",
      LIVEKIT_URL: "wss://primary.livekit.cloud",
      NEXT_PUBLIC_LIVEKIT_URL: "wss://legacy.livekit.cloud",
    });

    expect(config).toEqual({
      apiKey: "key",
      apiSecret: "secret",
      url: "wss://primary.livekit.cloud",
    });
  });

  it("falls back to NEXT_PUBLIC_LIVEKIT_URL for backwards compatibility", () => {
    const config = getLiveKitServerConfig({
      LIVEKIT_API_KEY: "key",
      LIVEKIT_API_SECRET: "secret",
      NEXT_PUBLIC_LIVEKIT_URL: "wss://legacy.livekit.cloud",
    });

    expect(config).toEqual({
      apiKey: "key",
      apiSecret: "secret",
      url: "wss://legacy.livekit.cloud",
    });
  });

  it("reports a disabled status when required config is missing", () => {
    expect(getLiveKitConfigStatus({ LIVEKIT_API_KEY: "key" })).toEqual({
      enabled: false,
      error: LIVEKIT_UNCONFIGURED_ERROR,
    });
  });
});

describe("/api/livekit-token route", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
    restoreEnv();
  });

  it("returns voice availability for configured environments", async () => {
    process.env.LIVEKIT_API_KEY = "key";
    process.env.LIVEKIT_API_SECRET = "secret";
    process.env.LIVEKIT_URL = "wss://voice.livekit.cloud";
    delete process.env.NEXT_PUBLIC_LIVEKIT_URL;

    const { GET } = await import("../app/api/livekit-token/route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ enabled: true });
  });

  it("uses LIVEKIT_URL when generating tokens", async () => {
    process.env.LIVEKIT_API_KEY = "key";
    process.env.LIVEKIT_API_SECRET = "secret";
    process.env.LIVEKIT_URL = "wss://voice.livekit.cloud";
    delete process.env.NEXT_PUBLIC_LIVEKIT_URL;

    const { POST } = await import("../app/api/livekit-token/route");
    const response = await POST(
      new Request("http://localhost/api/livekit-token", {
        method: "POST",
        body: JSON.stringify({ room_name: "motian-test-room" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.server_url).toBe("wss://voice.livekit.cloud");
    expect(body.participant_token).toEqual(expect.any(String));
  });

  it("returns 503 when LiveKit is unavailable", async () => {
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;
    delete process.env.LIVEKIT_URL;
    delete process.env.NEXT_PUBLIC_LIVEKIT_URL;

    const { GET, POST } = await import("../app/api/livekit-token/route");

    const availabilityResponse = await GET();
    expect(availabilityResponse.status).toBe(503);
    await expect(availabilityResponse.json()).resolves.toEqual({
      enabled: false,
      error: LIVEKIT_UNCONFIGURED_ERROR,
    });

    const tokenResponse = await POST(
      new Request("http://localhost/api/livekit-token", { method: "POST" }),
    );
    expect(tokenResponse.status).toBe(503);
    await expect(tokenResponse.json()).resolves.toEqual({
      error: LIVEKIT_UNCONFIGURED_ERROR,
    });
  });
});
