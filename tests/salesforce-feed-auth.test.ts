import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { proxy } from "../proxy";

describe("API auth via proxy", () => {
  const originalApiSecret = process.env.API_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVercelEnv = process.env.VERCEL_ENV;
  const chatFirstPartyEndpoints = [
    {
      description: "the chat stream endpoint",
      method: "POST",
      url: "http://localhost/api/chat",
    },
    {
      description: "the chat sessions list endpoint",
      method: "GET",
      url: "http://localhost/api/chat-sessies?limit=20",
    },
    {
      description: "nested chat session detail routes",
      method: "DELETE",
      url: "http://localhost/api/chat-sessies/session-123",
    },
  ] as const;

  const cvFirstPartyEndpoints = [
    {
      description: "the CV upload endpoint",
      method: "POST",
      url: "http://localhost/api/cv-upload",
    },
    {
      description: "the CV analyse endpoint",
      method: "POST",
      url: "http://localhost/api/cv-analyse",
    },
  ] as const;

  afterEach(() => {
    if (originalApiSecret === undefined) {
      delete process.env.API_SECRET;
    } else {
      process.env.API_SECRET = originalApiSecret;
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalVercelEnv === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = originalVercelEnv;
    }
  });

  it("allows same-origin access to /api/salesforce-feed without a bearer token", () => {
    process.env.API_SECRET = "test-secret";

    // Same-origin requests (no Origin header) are allowed as first-party browser routes
    const response = proxy(new NextRequest("http://localhost/api/salesforce-feed"));

    expect(response.status).toBe(200);
  });

  it("blocks cross-origin /api/salesforce-feed without a bearer token", async () => {
    process.env.API_SECRET = "test-secret";

    const response = proxy(
      new NextRequest("http://localhost/api/salesforce-feed", {
        headers: { Origin: "https://evil.example.com" },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Niet geautoriseerd",
    });
  });

  it("allows browser vacatures search without a bearer token when API_SECRET is configured", () => {
    process.env.API_SECRET = "test-secret";
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";

    const response = proxy(new NextRequest("http://localhost/api/opdrachten/zoeken?q=manager"));

    expect(response.status).toBe(200);
  });

  it("allows browser vacatures search when API_SECRET is missing in production", () => {
    delete process.env.API_SECRET;
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";

    const response = proxy(new NextRequest("http://localhost/api/opdrachten/zoeken?q=manager"));

    expect(response.status).toBe(200);
  });

  it.each(
    chatFirstPartyEndpoints,
  )("allows same-origin $description without a bearer token when API_SECRET is configured", ({
    method,
    url,
  }) => {
    process.env.API_SECRET = "test-secret";
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";

    // Same-origin requests have no Origin header
    const response = proxy(new NextRequest(url, { method }));

    expect(response.status).toBe(200);
  });

  it.each(
    chatFirstPartyEndpoints,
  )("allows same-origin $description when the browser sends its own Origin header", ({
    method,
    url,
  }) => {
    process.env.API_SECRET = "test-secret";
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";

    const response = proxy(
      new NextRequest(url, {
        method,
        headers: { Origin: new URL(url).origin },
      }),
    );

    expect(response.status).toBe(200);
  });

  it.each(chatFirstPartyEndpoints)("blocks cross-origin $description without a bearer token", ({
    method,
    url,
  }) => {
    process.env.API_SECRET = "test-secret";
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";

    // Cross-origin request from unknown origin should be rejected
    const response = proxy(
      new NextRequest(url, {
        method,
        headers: { Origin: "https://evil.example.com" },
      }),
    );

    expect(response.status).toBe(401);
  });

  it.each(
    chatFirstPartyEndpoints,
  )("allows $description with valid bearer token regardless of origin", ({ method, url }) => {
    process.env.API_SECRET = "test-secret";
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";

    const response = proxy(
      new NextRequest(url, {
        method,
        headers: {
          Authorization: "Bearer test-secret",
          Origin: "https://evil.example.com",
        },
      }),
    );

    expect(response.status).toBe(200);
  });

  it.each(
    cvFirstPartyEndpoints,
  )("allows same-origin $description without a bearer token when API_SECRET is configured", ({
    method,
    url,
  }) => {
    process.env.API_SECRET = "test-secret";
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";

    const response = proxy(new NextRequest(url, { method }));

    expect(response.status).toBe(200);
  });

  it.each(cvFirstPartyEndpoints)("blocks cross-origin $description without a bearer token", ({
    method,
    url,
  }) => {
    process.env.API_SECRET = "test-secret";
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";

    const response = proxy(
      new NextRequest(url, {
        method,
        headers: { Origin: "https://evil.example.com" },
      }),
    );

    expect(response.status).toBe(401);
  });

  it.each(
    cvFirstPartyEndpoints,
  )("allows $description with valid bearer token regardless of origin", ({ method, url }) => {
    process.env.API_SECRET = "test-secret";
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";

    const response = proxy(
      new NextRequest(url, {
        method,
        headers: {
          Authorization: "Bearer test-secret",
          Origin: "https://evil.example.com",
        },
      }),
    );

    expect(response.status).toBe(200);
  });

  it("fails closed in production for cross-origin salesforce-feed when API_SECRET is missing", async () => {
    delete process.env.API_SECRET;
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";

    const response = proxy(
      new NextRequest("http://localhost/api/salesforce-feed", {
        headers: { Origin: "https://external.example.com" },
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "API authenticatie niet geconfigureerd",
    });
  });

  it("keeps local and test routes usable when API_SECRET is missing", () => {
    delete process.env.API_SECRET;
    process.env.NODE_ENV = "test";
    delete process.env.VERCEL_ENV;

    const response = proxy(new NextRequest("http://localhost/api/salesforce-feed"));

    expect(response.status).toBe(200);
  });
});
