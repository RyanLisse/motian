import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { proxy } from "../proxy";
import { createTestAuthHeaders, TEST_API_SECRET } from "./helpers/session";

describe("API auth via proxy (API_SECRET bearer admission)", () => {
  const originalApiSecret = process.env.API_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVercelEnv = process.env.VERCEL_ENV;

  const protectedEndpoints = [
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
    {
      description: "the platform credentials route",
      method: "POST",
      url: "http://localhost/api/platforms/example-platform/credentials",
    },
    {
      description: "the salesforce feed",
      method: "GET",
      url: "http://localhost/api/salesforce-feed",
    },
  ] as const;

  beforeEach(() => {
    process.env.API_SECRET = TEST_API_SECRET;
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";
  });

  afterEach(() => {
    if (originalApiSecret === undefined) delete process.env.API_SECRET;
    else process.env.API_SECRET = originalApiSecret;

    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;

    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercelEnv;
  });

  it("AE1: Sec-Fetch-Site same-origin without bearer is rejected", async () => {
    const response = await proxy(
      new NextRequest("http://localhost/api/salesforce-feed", {
        headers: { "Sec-Fetch-Site": "same-origin" },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Niet geautoriseerd" });
  });

  it("AE1: same request with a valid API_SECRET bearer is admitted", async () => {
    const response = await proxy(
      new NextRequest("http://localhost/api/salesforce-feed", {
        headers: createTestAuthHeaders(TEST_API_SECRET, { "Sec-Fetch-Site": "same-origin" }),
      }),
    );

    expect(response.status).toBe(200);
  });

  it("rejects Host-derived Origin match without bearer (no header admission)", async () => {
    const response = await proxy(
      new NextRequest("http://localhost/api/cv-upload", {
        method: "POST",
        headers: {
          Origin: "http://localhost",
          Host: "localhost",
        },
      }),
    );

    expect(response.status).toBe(401);
  });

  it("does not treat Origin alone as admission for unsafe methods", async () => {
    const response = await proxy(
      new NextRequest("http://localhost/api/cv-upload", {
        method: "POST",
        headers: {
          Origin: "http://localhost",
          "Sec-Fetch-Site": "same-origin",
        },
      }),
    );

    expect(response.status).toBe(401);
  });

  it("allows public vacatures search without a principal", async () => {
    const response = await proxy(
      new NextRequest("http://localhost/api/opdrachten/zoeken?q=manager"),
    );

    expect(response.status).toBe(200);
  });

  it("allows /api/gezondheid without a principal", async () => {
    await expect(proxy(new NextRequest("http://localhost/api/gezondheid"))).resolves.toMatchObject({
      status: 200,
    });
  });

  it.each(protectedEndpoints)(
    "admits $description with a valid API_SECRET bearer regardless of origin",
    async ({ method, url }) => {
      const response = await proxy(
        new NextRequest(url, {
          method,
          headers: createTestAuthHeaders(TEST_API_SECRET, {
            Origin: "https://evil.example.com",
          }),
        }),
      );

      expect(response.status).toBe(200);
    },
  );

  it.each(protectedEndpoints)("rejects $description without bearer", async ({ method, url }) => {
    const response = await proxy(
      new NextRequest(url, {
        method,
        headers: { "Sec-Fetch-Site": "same-origin" },
      }),
    );

    expect(response.status).toBe(401);
  });

  it("fails closed in production when API_SECRET is missing", async () => {
    delete process.env.API_SECRET;

    const response = await proxy(
      new NextRequest("http://localhost/api/salesforce-feed", {
        headers: { Origin: "https://external.example.com" },
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "API authenticatie niet geconfigureerd",
    });
  });

  it("keeps local/test routes usable when API_SECRET is missing", async () => {
    delete process.env.API_SECRET;
    process.env.NODE_ENV = "test";
    delete process.env.VERCEL_ENV;

    const response = await proxy(new NextRequest("http://localhost/api/salesforce-feed"));
    expect(response.status).toBe(200);
  });

  it("does not redirect page requests to a login gate", async () => {
    // Pages are outside the proxy matcher; calling proxy on a page path should
    // still never emit a login redirect (internal app — no /inloggen).
    const response = await proxy(new NextRequest("http://localhost/kandidaten"));
    expect(response.status).not.toBe(307);
    expect(response.headers.get("location") ?? "").not.toContain("/inloggen");
  });
});
