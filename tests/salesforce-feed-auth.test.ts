import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";

describe("Salesforce feed auth via proxy", () => {
  const originalApiSecret = process.env.API_SECRET;

  afterEach(() => {
    if (originalApiSecret === undefined) {
      delete process.env.API_SECRET;
      return;
    }

    process.env.API_SECRET = originalApiSecret;
  });

  it("requires the shared bearer token for /api/salesforce-feed", async () => {
    process.env.API_SECRET = "test-secret";

    const response = proxy(new NextRequest("http://localhost/api/salesforce-feed"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Niet geautoriseerd" });
  });
});