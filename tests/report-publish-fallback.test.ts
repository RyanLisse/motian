import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("report publish fallback durability (AE6)", () => {
  const matchId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("MARKDOWN_FAST_TOKEN", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("local publish returns /reports/<matchId> without an in-process store", async () => {
    vi.resetModules();
    const { publishReport } = await import("../src/lib/markdown-fast");

    const result = await publishReport("# Matchrapport", "Test", matchId);

    expect(result.source).toBe("local");
    expect(result.id).toBe(matchId);
    expect(result.url).toBe(`/reports/${matchId}`);
  });

  it("fresh module instance still returns the same durable URL (AE6)", async () => {
    vi.resetModules();
    const first = await import("../src/lib/markdown-fast");
    const published = await first.publishReport("# Matchrapport", "Test", matchId);

    // Simulate a different serverless instance: clear module registry and re-import
    vi.resetModules();
    const second = await import("../src/lib/markdown-fast");
    const again = await second.publishReport("# Matchrapport", "Test", matchId);

    expect(published.url).toBe(`/reports/${matchId}`);
    expect(again.url).toBe(published.url);
    expect(again.id).toBe(matchId);
  });

  it("does not export listLocalReports or keep a reportStore Map", async () => {
    vi.resetModules();
    const mod = await import("../src/lib/markdown-fast");
    expect(mod).not.toHaveProperty("listLocalReports");
    expect(mod).not.toHaveProperty("reportStore");
  });

  it("getReport returns null for local ids when markdown.fast is unset", async () => {
    vi.resetModules();
    const { getReport } = await import("../src/lib/markdown-fast");
    expect(await getReport(matchId)).toBeNull();
  });
});
