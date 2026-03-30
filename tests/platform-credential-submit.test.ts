import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitPlatformCredentials } from "../components/chat/genui/credential-submit";

describe("submitPlatformCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws the API error when the credentials endpoint returns a non-2xx response", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Geen configuratie gevonden" }),
    });

    await expect(
      submitPlatformCredentials({
        fetchFn,
        platform: "example-platform",
        values: { username: "user", password: "secret" },
      }),
    ).rejects.toThrow("Geen configuratie gevonden");
  });

  it("returns the accepted payload when the credentials endpoint succeeds", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ platform: "example-platform", runId: "run-123", resumed: true }),
    });

    await expect(
      submitPlatformCredentials({
        fetchFn,
        platform: "example-platform",
        values: { username: "user", password: "secret" },
      }),
    ).resolves.toEqual({ platform: "example-platform", runId: "run-123", resumed: true });
  });
});
