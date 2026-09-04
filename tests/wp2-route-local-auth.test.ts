import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UNAUTHORIZED_MESSAGE } from "@/src/lib/api-auth";
import { withApiHandler } from "@/src/lib/api-handler";
import { createTestAuthHeaders, TEST_API_SECRET } from "./helpers/session";

/**
 * WP2 route-local auth: unauthenticated callers must be rejected before
 * persistence / scrape triggers. Heavy route modules are asserted structurally
 * so Vitest does not pull the full DB/service graph.
 */

describe("WP2 route-local requirePrincipal", () => {
  it("withApiHandler rejects unauthenticated requests before the handler body", async () => {
    const previousApi = process.env.API_SECRET;
    process.env.API_SECRET = TEST_API_SECRET;

    const bodyRan = { value: false };
    const handler = withApiHandler(async () => {
      bodyRan.value = true;
      return Response.json({ ok: true });
    });

    try {
      const response = await handler(new Request("http://localhost/api/kandidaten"));
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: UNAUTHORIZED_MESSAGE });
      expect(bodyRan.value).toBe(false);
    } finally {
      if (previousApi === undefined) delete process.env.API_SECRET;
      else process.env.API_SECRET = previousApi;
    }
  });

  it("withApiHandler admits a valid API_SECRET bearer and runs the handler", async () => {
    const previousApi = process.env.API_SECRET;
    process.env.API_SECRET = TEST_API_SECRET;

    const handler = withApiHandler(async () => Response.json({ ok: true }));

    try {
      const response = await handler(
        new Request("http://localhost/api/kandidaten", {
          headers: createTestAuthHeaders(TEST_API_SECRET),
        }),
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ ok: true });
    } finally {
      if (previousApi === undefined) delete process.env.API_SECRET;
      else process.env.API_SECRET = previousApi;
    }
  });

  it("withApiHandler auth: public skips the principal check", async () => {
    const previousApi = process.env.API_SECRET;
    process.env.API_SECRET = TEST_API_SECRET;

    const handler = withApiHandler(async () => Response.json({ ok: true }), { auth: "public" });

    try {
      const response = await handler(new Request("http://localhost/api/gezondheid"));
      expect(response.status).toBe(200);
    } finally {
      if (previousApi === undefined) delete process.env.API_SECRET;
      else process.env.API_SECRET = previousApi;
    }
  });

  it("withApiHandler fails closed when required auth has no Request argument", async () => {
    const previousApi = process.env.API_SECRET;
    process.env.API_SECRET = TEST_API_SECRET;

    const bodyRan = { value: false };
    const handler = withApiHandler(async () => {
      bodyRan.value = true;
      return Response.json({ ok: true });
    });

    try {
      // Simulate a miswired wrapper call with no Request — must not skip auth.
      const response = await handler();
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: UNAUTHORIZED_MESSAGE });
      expect(bodyRan.value).toBe(false);
    } finally {
      if (previousApi === undefined) delete process.env.API_SECRET;
      else process.env.API_SECRET = previousApi;
    }
  });

  it("critical non-public route sources enforce a principal", () => {
    const files = [
      "app/api/cv-upload/route.ts",
      "app/api/cv-upload/save/route.ts",
      "app/api/cv-file/route.ts",
      "app/api/cv-analyse/route.ts",
      "app/api/gdpr/export/[kandidaatId]/route.ts",
      "app/api/gdpr/verwijder/[kandidaatId]/route.ts",
      "app/api/platforms/[slug]/credentials/route.ts",
      "app/api/scrape/starten/route.ts",
      "app/api/kandidaten/route.ts",
    ];

    for (const rel of files) {
      const source = readFileSync(join(process.cwd(), rel), "utf8");
      const enforced = source.includes("requirePrincipal") || source.includes("withApiHandler");
      expect(enforced, `${rel} must call requirePrincipal or withApiHandler`).toBe(true);
    }
  });

  it("withApiHandler defaults to required auth and public routes opt out", () => {
    const handler = readFileSync(join(process.cwd(), "src/lib/api-handler.ts"), "utf8");
    expect(handler).toContain('auth?: "required" | "public"');
    expect(handler).toContain('options.auth ?? "required"');
    expect(handler).toContain("requirePrincipal");

    const gezondheid = readFileSync(join(process.cwd(), "app/api/gezondheid/route.ts"), "utf8");
    expect(gezondheid).toContain('auth: "public"');
  });
});
