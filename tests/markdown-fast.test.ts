import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const ROOT = path.resolve(__dirname, "..");
function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("Markdown.fast integration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("publishReport returns a durable /reports/<matchId> URL when markdown.fast is unset", async () => {
    vi.stubEnv("MARKDOWN_FAST_TOKEN", "");
    vi.resetModules();
    const { publishReport } = await import("../src/lib/markdown-fast");
    const matchId = "22222222-2222-4222-8222-222222222222";
    const result = await publishReport("# md", "title", matchId);
    expect(result.source).toBe("local");
    expect(result.url).toBe(`/reports/${matchId}`);
  });

  it("exports getReport and revokeReport", async () => {
    vi.resetModules();
    const mod = await import("../src/lib/markdown-fast");
    expect(typeof mod.getReport).toBe("function");
    expect(typeof mod.revokeReport).toBe("function");
  });

  it("records revokeReport as an unused residual (no production callers)", () => {
    // Behavioral residual gate: revokeReport must remain exported, but nothing may call it yet.
    const source = readFile("src/lib/markdown-fast.ts");
    expect(source).toContain("export async function revokeReport");
    expect(source).toContain("RESIDUAL");

    const callers = [
      readFile("src/services/gdpr.ts"),
      readFile("app/api/reports/route.ts"),
      readFile("app/reports/[id]/page.tsx"),
    ];
    for (const file of callers) {
      expect(file).not.toMatch(/\brevokeReport\s*\(/);
    }
  });

  it("uses MARKDOWN_FAST_TOKEN for auth on external publish", async () => {
    vi.stubEnv("MARKDOWN_FAST_TOKEN", "test-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://markdown.fast/r/abc", id: "abc" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.resetModules();

    const { publishReport } = await import("../src/lib/markdown-fast");
    const result = await publishReport("# md", "title", "33333333-3333-4333-8333-333333333333");

    expect(result.source).toBe("markdown.fast");
    expect(fetchMock).toHaveBeenCalled();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({
      Authorization: "Bearer test-token",
    });
  });

  it("has timeout protection on external calls", () => {
    const source = readFile("src/lib/markdown-fast.ts");
    expect(source).toContain("AbortSignal.timeout");
  });

  it("does not keep an in-process reportStore Map", () => {
    const source = readFile("src/lib/markdown-fast.ts");
    expect(source).not.toContain("reportStore");
    expect(source).not.toContain("listLocalReports");
  });
});
