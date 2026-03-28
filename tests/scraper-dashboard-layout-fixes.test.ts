import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]) {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("scraper dashboard layout fixes", () => {
  it("shows the chat widget on all pages except the dedicated chat page", () => {
    const source = readFile("components", "chat", "chat-widget.tsx");

    // Chat widget is now visible on all pages except /chat (the full-page view replaces it)
    expect(source).toContain('if (pathname === "/chat") return null;');
    expect(source).not.toContain("disableWidget");
    expect(source).toContain("{open && (");
    expect(source).toContain('role="dialog"');
  });

  it("uses non-overlapping mobile shell controls and wrapping page actions", () => {
    const sidebarLayout = readFile("components", "sidebar-layout.tsx");
    const pageHeader = readFile("components", "page-header.tsx");
    const scraperActions = readFile("app", "scraper", "actions.tsx");

    expect(sidebarLayout).toContain("sticky top-0 z-30");
    expect(sidebarLayout).not.toContain("fixed left-3 top-3");
    expect(pageHeader).toContain("flex-wrap items-center gap-2");
    expect(pageHeader).toContain("sm:self-start");
    expect(scraperActions).toContain("w-full flex-col items-stretch");
    expect(scraperActions).toContain('aria-live="polite"');
  });

  it("keeps scraper monitoring cards contained on mobile widths", () => {
    const source = readFile("app", "scraper", "page.tsx");
    const table = readFile("components", "ui", "table.tsx");

    expect(source).toContain("xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]");
    expect(source).toContain('className="min-w-0 overflow-hidden bg-card border-border"');
    expect(source).not.toContain('className="w-full min-w-0 overflow-x-auto"');
    expect(source).toContain('<Table className="min-w-[760px]">');
    expect(table).toContain('data-slot="table-container"');
    expect(table).toContain('className="relative w-full overflow-x-auto"');
    expect(source).toContain('className="flex flex-wrap items-start justify-between gap-3"');
    expect(source).toContain('className="min-w-0 flex-1"');
    // Note: className changed from "break-words" to "wrap-break-word"
    // for consistent word-wrap behavior across browsers
    expect(source).toContain(
      'className="wrap-break-word rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground"',
    );
  });

  it("loads scraper page datasets sequentially instead of bursting dashboard and catalog queries together", () => {
    const source = readFile("app", "scraper", "page.tsx");

    expect(source).toContain("const scraperDashboard = await getScraperDashboardData(");
    expect(source).toContain("const platformCatalog = await listPlatformCatalog();");
    expect(source).not.toContain("await Promise.all([");
  });

  it("keeps recent activity logs clipped to the feed card and scroll viewport", () => {
    const source = readFile("components", "scraper", "recent-activity-feed.tsx");

    expect(source).toContain('className="min-w-0 overflow-hidden bg-card border-border"');
    expect(source).toContain('className="min-w-0 overflow-hidden"');
    expect(source).toContain(
      'className="w-full max-h-[420px] overflow-hidden [&>[data-slot=scroll-area-viewport]]:max-h-[420px]"',
    );
    expect(source).toContain('className="min-w-0 space-y-3 pr-4"');
    expect(source).toContain('className="min-w-0 rounded-xl border border-border bg-muted/20 p-4"');
  });
});
