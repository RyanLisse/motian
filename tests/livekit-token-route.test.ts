import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("POST /api/livekit-token", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    delete process.env.NEXT_PUBLIC_LIVEKIT_URL;
    delete process.env.LIVEKIT_URL;
  });

  it("returns a token payload when all required env vars are configured", async () => {
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

  it("returns 500 error when NEXT_PUBLIC_LIVEKIT_URL is missing", async () => {
    vi.stubEnv("LIVEKIT_API_KEY", "test-livekit-key");
    vi.stubEnv("LIVEKIT_API_SECRET", "test-livekit-secret");
    vi.stubEnv("LIVEKIT_URL", "wss://motian.livekit.cloud");
    // NEXT_PUBLIC_LIVEKIT_URL is intentionally not set

    const { POST } = await import("../app/api/livekit-token/route");
    const response = await POST(
      new Request("http://localhost/api/livekit-token", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(500);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toBe("LiveKit niet geconfigureerd");
  });
});
