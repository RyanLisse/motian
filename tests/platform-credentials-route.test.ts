import { beforeEach, describe, expect, it, vi } from "vitest";

const { createConfig, recordPlatformOnboardingEvent, trigger } = vi.hoisted(() => ({
  createConfig: vi.fn(),
  recordPlatformOnboardingEvent: vi.fn(),
  trigger: vi.fn(),
}));

vi.mock("@/src/services/scrapers", () => ({
  createConfig,
  recordPlatformOnboardingEvent,
}));

vi.mock("@trigger.dev/sdk", () => ({
  tasks: {
    trigger,
  },
}));

import { POST } from "../app/api/platforms/[slug]/credentials/route";

describe("platform credentials route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates or updates the scraper config and resumes onboarding asynchronously", async () => {
    createConfig.mockResolvedValue({
      id: "cfg-123",
      platform: "example-platform",
    });
    trigger.mockResolvedValue({ id: "run-123" });

    const response = await POST(
      new Request("http://localhost/api/platforms/example-platform/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "user", password: "secret" }),
      }),
      { params: Promise.resolve({ slug: "example-platform" }) },
    );

    expect(createConfig).toHaveBeenCalledWith({
      platform: "example-platform",
      authConfig: { username: "user", password: "secret" },
      source: "ui",
    });
    expect(recordPlatformOnboardingEvent).toHaveBeenCalledWith({
      platform: "example-platform",
      source: "ui",
      event: {
        type: "credentials_received",
        evidence: {
          providedFields: ["username", "password"],
        },
      },
    });
    expect(trigger).toHaveBeenCalledWith("platform-onboard", {
      platform: "example-platform",
      source: "ui",
    });
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      credentialId: "cfg-123",
      platform: "example-platform",
      resumed: true,
      runId: "run-123",
    });
  });

  it("rejects an empty credentials payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/platforms/example-platform/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ slug: "example-platform" }) },
    );

    expect(createConfig).not.toHaveBeenCalled();
    expect(trigger).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Ongeldige inloggegevens",
    });
  });

  it("returns a descriptive error when credential persistence fails", async () => {
    createConfig.mockRejectedValue(
      new Error("Geen baseUrl beschikbaar voor platform example-platform"),
    );

    const response = await POST(
      new Request("http://localhost/api/platforms/example-platform/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "user", password: "secret" }),
      }),
      { params: Promise.resolve({ slug: "example-platform" }) },
    );

    expect(recordPlatformOnboardingEvent).toHaveBeenCalledWith({
      platform: "example-platform",
      source: "ui",
      event: {
        type: "credentials_received",
        evidence: {
          providedFields: ["username", "password"],
        },
      },
    });
    expect(trigger).not.toHaveBeenCalled();
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Geen baseUrl beschikbaar voor platform example-platform",
    });
  });
});
