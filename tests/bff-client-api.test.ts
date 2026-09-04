import { describe, expect, it, vi } from "vitest";
import {
  buildBffUpstreamHeaders,
  isFirstPartyBrowserRequest,
  resolveBffApiPath,
} from "@/src/lib/bff";
import { apiFetch, toBffPath } from "@/src/lib/client-api";
import { TEST_API_SECRET } from "./helpers/session";

describe("client-api BFF path rewrite", () => {
  it("rewrites /api paths to /bff and preserves query strings", () => {
    expect(toBffPath("/api/cv-upload")).toBe("/bff/cv-upload");
    expect(toBffPath("/api/chat-sessies/abc?limit=20")).toBe("/bff/chat-sessies/abc?limit=20");
    expect(toBffPath("/bff/already")).toBe("/bff/already");
  });

  it("apiFetch calls fetch with the BFF path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
    const previous = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      await apiFetch("/api/kandidaten/1", { method: "DELETE" });
      expect(fetchMock).toHaveBeenCalledWith("/bff/kandidaten/1", { method: "DELETE" });
    } finally {
      globalThis.fetch = previous;
    }
  });
});

describe("bff helpers", () => {
  it("resolves path segments to /api and rejects traversal", () => {
    expect(resolveBffApiPath(["cv-upload"])).toBe("/api/cv-upload");
    expect(resolveBffApiPath(["chat-sessies", "abc"])).toBe("/api/chat-sessies/abc");
    expect(resolveBffApiPath(["..", "etc"])).toBeNull();
    expect(resolveBffApiPath(["bff", "cv-upload"])).toBeNull();
    expect(resolveBffApiPath([])).toBeNull();
  });

  it("admits same-origin browser signals and rejects cross-site", () => {
    expect(
      isFirstPartyBrowserRequest(
        new Request("http://localhost:3002/bff/chat", {
          headers: { Origin: "http://localhost:3002", "Sec-Fetch-Site": "same-origin" },
        }),
      ),
    ).toBe(true);

    expect(
      isFirstPartyBrowserRequest(
        new Request("http://localhost:3002/bff/chat", {
          headers: { "Sec-Fetch-Site": "same-origin" },
        }),
      ),
    ).toBe(true);

    expect(
      isFirstPartyBrowserRequest(
        new Request("http://localhost:3002/bff/chat", {
          headers: { Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" },
        }),
      ),
    ).toBe(false);
  });

  it("attaches API_SECRET bearer and strips inbound Authorization", () => {
    const previous = process.env.API_SECRET;
    process.env.API_SECRET = TEST_API_SECRET;

    try {
      const headers = buildBffUpstreamHeaders(
        new Request("http://localhost/bff/cv-upload", {
          headers: {
            Authorization: "Bearer forged",
            "Content-Type": "application/json",
            Origin: "http://localhost",
          },
        }),
      );
      expect(headers.get("Authorization")).toBe(`Bearer ${TEST_API_SECRET}`);
      expect(headers.get("Content-Type")).toBe("application/json");
    } finally {
      if (previous === undefined) delete process.env.API_SECRET;
      else process.env.API_SECRET = previous;
    }
  });
});
