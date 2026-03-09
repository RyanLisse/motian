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

  it("returns a token payload when only LIVEKIT_URL is configured", async () => {
    vi.stubEnv("LIVEKIT_API_KEY", "test-livekit-key");
    vi.stubEnv("LIVEKIT_API_SECRET", "test-livekit-secret");
    vi.stubEnv("LIVEKIT_URL", "wss://motian.livekit.cloud");

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
    expect(body.server_url).toBe("wss://motian.livekit.cloud");
    expect(body.participant_token).toEqual(expect.any(String));
    expect(body.participant_token?.split(".")).toHaveLength(3);
  });
});
