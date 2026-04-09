import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]) {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("runtime cost reduction cleanup", () => {
  it("removes the unused Trigger tasks and generic SSE route", () => {
    expect(fs.existsSync(path.join(ROOT, "trigger", "whatsapp-gateway.ts"))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, "trigger", "autopilot-nightly.ts"))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, "app", "api", "events", "route.ts"))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, "components", "data-refresh-listener.tsx"))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, "src", "hooks", "use-event-source.ts"))).toBe(false);
  });

  it("returns a static disabled WhatsApp status payload", async () => {
    const mod = await import("../app/api/whatsapp/status/route");
    const response = await mod.GET();

    expect(mod.dynamic).toBe("force-static");
    expect(mod.revalidate).toBe(300);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      enabled: false,
      status: "disabled",
      message: "WhatsApp integratie is uitgeschakeld",
    });
  });

  it("reduces scheduled Trigger wake-ups and right-sizes lighter agents", () => {
    const scrapePipeline = readFile("trigger", "scrape-pipeline.ts");
    const embeddingsBatch = readFile("trigger", "embeddings-batch.ts");
    const cacheRefresh = readFile("trigger", "cache-refresh.ts");
    const orchestrator = readFile("trigger", "agent-orchestrator.ts");
    const matcher = readFile("trigger", "agent-matcher.ts");
    const sourcing = readFile("trigger", "agent-sourcing.ts");

    expect(scrapePipeline).toContain('pattern: "0 6,10,14,18 * * *"');
    expect(embeddingsBatch).toContain('pattern: "15 6,10,14,18 * * *"');
    expect(cacheRefresh).toContain('pattern: "20 6,10,14,18 * * *"');
    expect(orchestrator).toContain('pattern: "0 */12 * * *"');
    expect(matcher).toContain('machine: { preset: "small-2x" }');
    expect(sourcing).toContain('machine: { preset: "small-2x" }');
  });

  it("keeps the agent and scraper surfaces on polling-only refresh paths", () => {
    const activityFeed = readFile("components", "agents", "activity-feed.tsx");
    const scraperActions = readFile("app", "scraper", "actions.tsx");

    expect(activityFeed).toContain("const POLL_INTERVAL_MS = 60_000");
    expect(activityFeed).toContain('document.visibilityState === "visible"');
    expect(activityFeed).not.toContain("EventSource");

    expect(scraperActions).toContain("const SCRAPER_POLL_INTERVAL_MS = 15_000");
    expect(scraperActions).toContain("const SCRAPER_POLL_TIMEOUT_MS = 2 * 60_000");
    expect(scraperActions).toContain("router.refresh()");
    expect(scraperActions).not.toContain("useEventSource");
    expect(scraperActions).not.toContain("EventSource");
  });

  it("removes SSE refresh listeners from recruiter pages and proxy allowlists", () => {
    const kandidatenPage = readFile("app", "kandidaten", "page.tsx");
    const pipelinePage = readFile("app", "pipeline", "page.tsx");
    const interviewsPage = readFile("app", "interviews", "page.tsx");
    const messagesPage = readFile("app", "messages", "page.tsx");
    const vacaturesPage = readFile("app", "vacatures", "page.tsx");
    const proxySource = readFile("proxy.ts");

    expect(kandidatenPage).not.toContain("DataRefreshListener");
    expect(pipelinePage).not.toContain("DataRefreshListener");
    expect(interviewsPage).not.toContain("DataRefreshListener");
    expect(messagesPage).not.toContain("DataRefreshListener");
    expect(vacaturesPage).not.toContain("DataRefreshListener");
    expect(proxySource).not.toContain('"/api/events"');
  });
});
