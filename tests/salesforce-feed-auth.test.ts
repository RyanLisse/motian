import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { proxy } from "../proxy";

describe("Salesforce feed auth via proxy", () => {
  const originalApiSecret = process.env.API_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVercelEnv = process.env.VERCEL_ENV;

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

  it("requires the shared bearer token for /api/salesforce-feed", async () => {
    process.env.API_SECRET = "test-secret";

    const response = proxy(new NextRequest("http://localhost/api/salesforce-feed"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Niet geautoriseerd",
    });
  });

  it("fails closed in production when API_SECRET is missing", async () => {
    delete process.env.API_SECRET;
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";

    const response = proxy(new NextRequest("http://localhost/api/salesforce-feed"));

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
