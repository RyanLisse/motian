import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLiveKitConfigStatus,
  getLiveKitServerConfig,
  LIVEKIT_UNCONFIGURED_ERROR,
} from "../src/lib/livekit";

describe("LiveKit config helpers", () => {
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
    vi.unstubAllEnvs();
    delete process.env.NEXT_PUBLIC_LIVEKIT_URL;
    delete process.env.LIVEKIT_URL;
  });

  it("returns voice availability for configured environments", async () => {
    vi.stubEnv("LIVEKIT_API_KEY", "test-livekit-key");
    vi.stubEnv("LIVEKIT_API_SECRET", "test-livekit-secret");
    vi.stubEnv("LIVEKIT_URL", "wss://motian.livekit.cloud");

    const { GET } = await import("../app/api/livekit-token/route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ enabled: true });
  });

  it("returns a token payload and prefers NEXT_PUBLIC_LIVEKIT_URL for the client", async () => {
    vi.stubEnv("LIVEKIT_API_KEY", "test-livekit-key");
    vi.stubEnv("LIVEKIT_API_SECRET", "test-livekit-secret");
    vi.stubEnv("LIVEKIT_URL", "wss://motian.livekit.cloud");
    vi.stubEnv("NEXT_PUBLIC_LIVEKIT_URL", "wss://public.livekit.cloud");

    const { POST } = await import("../app/api/livekit-token/route");
    const response = await POST(
      new Request("http://localhost/api/livekit-token", {
        method: "POST",
        body: JSON.stringify({
          room_name: "motian-audio-room",
          participant_name: "Recruiter",
          participant_identity: "recruiter-123",
        }),
      }),
    );

    const body = (await response.json()) as {
      participant_token?: string;
      server_url?: string;
    };

    expect(response.status).toBe(200);
    expect(body.server_url).toBe("wss://public.livekit.cloud");
    expect(body.participant_token).toEqual(expect.any(String));
    expect(body.participant_token?.split(".")).toHaveLength(3);
  });

  it("falls back to LIVEKIT_URL when NEXT_PUBLIC_LIVEKIT_URL is missing", async () => {
    vi.stubEnv("LIVEKIT_API_KEY", "test-livekit-key");
    vi.stubEnv("LIVEKIT_API_SECRET", "test-livekit-secret");
    vi.stubEnv("LIVEKIT_URL", "wss://motian.livekit.cloud");

    const { POST } = await import("../app/api/livekit-token/route");
    const response = await POST(
      new Request("http://localhost/api/livekit-token", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      server_url: "wss://motian.livekit.cloud",
      participant_token: expect.any(String),
    });
  });

  it("returns 503 when LiveKit is unavailable", async () => {
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
