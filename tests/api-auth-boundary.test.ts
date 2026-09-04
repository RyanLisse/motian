import { describe, expect, it } from "vitest";
import {
  assertCanReadCandidate,
  authenticateRequest,
  requirePrincipal,
  UNAUTHORIZED_MESSAGE,
} from "@/src/lib/api-auth";
import { timingSafeEqual, timingSafeEqualStrings } from "@/src/lib/session";
import { createTestAuthHeaders, TEST_API_SECRET } from "./helpers/session";

describe("api-auth boundary", () => {
  it("authenticateRequest resolves a valid API_SECRET bearer to a service principal", async () => {
    const previousApi = process.env.API_SECRET;
    process.env.API_SECRET = TEST_API_SECRET;

    try {
      const request = new Request("http://localhost/api/agent-events", {
        headers: createTestAuthHeaders(TEST_API_SECRET),
      });

      await expect(authenticateRequest(request)).resolves.toEqual({
        kind: "service",
        sub: "api-secret",
        candidateAccess: "all",
      });
    } finally {
      if (previousApi === undefined) delete process.env.API_SECRET;
      else process.env.API_SECRET = previousApi;
    }
  });

  it("authenticateRequest rejects Origin / cookie-only signals when API_SECRET is set", async () => {
    const previousApi = process.env.API_SECRET;
    process.env.API_SECRET = TEST_API_SECRET;

    try {
      const request = new Request("http://localhost/api/kandidaten", {
        headers: {
          Origin: "http://localhost",
          "Sec-Fetch-Site": "same-origin",
          cookie: "motian_sessie=forged",
        },
      });

      await expect(authenticateRequest(request)).resolves.toBeNull();
    } finally {
      if (previousApi === undefined) delete process.env.API_SECRET;
      else process.env.API_SECRET = previousApi;
    }
  });

  it("authenticateRequest admits a local-dev principal when API_SECRET is unset outside production", async () => {
    const previousApi = process.env.API_SECRET;
    const previousNode = process.env.NODE_ENV;
    const previousVercel = process.env.VERCEL_ENV;
    delete process.env.API_SECRET;
    process.env.NODE_ENV = "test";
    delete process.env.VERCEL_ENV;

    try {
      await expect(
        authenticateRequest(new Request("http://localhost/api/kandidaten")),
      ).resolves.toEqual({
        kind: "service",
        sub: "local-dev",
        candidateAccess: "all",
      });
    } finally {
      if (previousApi === undefined) delete process.env.API_SECRET;
      else process.env.API_SECRET = previousApi;
      process.env.NODE_ENV = previousNode;
      if (previousVercel === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = previousVercel;
    }
  });

  it("requirePrincipal returns a Dutch 401 Response when API_SECRET is set without bearer", async () => {
    const previousApi = process.env.API_SECRET;
    process.env.API_SECRET = TEST_API_SECRET;

    try {
      const result = await requirePrincipal(new Request("http://localhost/api/kandidaten"));
      expect(result).toBeInstanceOf(Response);
      if (!(result instanceof Response)) throw new Error("expected Response");
      expect(result.status).toBe(401);
      await expect(result.json()).resolves.toEqual({ error: UNAUTHORIZED_MESSAGE });
    } finally {
      if (previousApi === undefined) delete process.env.API_SECRET;
      else process.env.API_SECRET = previousApi;
    }
  });

  it("assertCanReadCandidate denies an out-of-list service principal (AE2 seam)", async () => {
    const principal = {
      kind: "service" as const,
      sub: "scoped",
      candidateAccess: { allow: ["cand-a"] },
    };

    await expect(assertCanReadCandidate(principal, "cand-a")).resolves.toBe("allow");
    await expect(assertCanReadCandidate(principal, "cand-b")).resolves.toBe("deny");
    await expect(assertCanReadCandidate(principal, "")).resolves.toBe("deny");
  });

  it("assertCanReadCandidate allows an operator with candidateAccess all", async () => {
    await expect(
      assertCanReadCandidate(
        { kind: "operator", sub: "operator", candidateAccess: "all" },
        "any-id",
      ),
    ).resolves.toBe("allow");
  });

  it("timingSafeEqual compares byte values in constant time", () => {
    expect(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
    expect(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
    expect(timingSafeEqualStrings("same", "same")).toBe(true);
    expect(timingSafeEqualStrings("same", "diff")).toBe(false);
  });
});
