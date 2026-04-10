import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]) {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf8");
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.doUnmock("@/hooks/use-mobile");
});

describe("GenUI mobile surfaces", () => {
  it("keeps the recruiter-core modules eager while secondary modules stay lazy", () => {
    const source = readFile("components", "chat", "genui", "registry.ts");

    expect(source).toContain('from "./action-card"');
    expect(source).toContain('from "./kandidaat-card"');
    expect(source).toContain('from "./kandidaat-list"');
    expect(source).toContain('from "./opdracht-card"');
    expect(source).toContain('from "./opdracht-list"');

    expect(source).toContain("component: OpdrachtGenUICard");
    expect(source).toContain("component: KandidaatGenUICard");
    expect(source).toContain("component: OpdrachtListCard");
    expect(source).toContain("component: KandidaatListCard");
    expect(source).toContain("component: MatchCreatedCard");

    expect(source).toContain('import("./match-card").then');
    expect(source).toContain('import("./match-list").then');
    expect(source).toContain('import("./comparison-table").then');
    expect(source).toContain('import("./platform-card").then');
  });

  it("renders comparison output as collapsible mobile cards instead of a table", async () => {
    vi.doMock("@/hooks/use-mobile", () => ({
      useIsMobile: () => true,
    }));

    const { ComparisonTable } = await import("../components/chat/genui/comparison-table");

    const html = renderToStaticMarkup(
      createElement(ComparisonTable, {
        output: {
          type: "comparison",
          title: "Structured match vergelijking",
          columns: ["Kandidaat A", "Kandidaat B"],
          items: [
            {
              label: "Sourcingdiepgang",
              values: { "Kandidaat A": 9, "Kandidaat B": 7 },
            },
          ],
        },
      }),
    );

    expect(html).toContain("<details");
    expect(html).not.toContain("<table");
    expect(html).toContain("Kandidaat A");
    expect(html).toContain("Sourcingdiepgang");
  });

  it("uses disclosure on mobile for platform stepper output and a single-column platform list", async () => {
    vi.doMock("@/hooks/use-mobile", () => ({
      useIsMobile: () => true,
    }));

    const { PlatformCard } = await import("../components/chat/genui/platform-card");

    const statusHtml = renderToStaticMarkup(
      createElement(PlatformCard, {
        output: {
          catalog: { slug: "linkedin", displayName: "LinkedIn" },
          config: { isActive: true, lastRunAt: "2026-04-09T09:00:00.000Z" },
          latestRun: { status: "active", currentStep: "validate" },
        },
      }),
    );

    expect(statusHtml).toContain("<details");
    expect(statusHtml).toContain("Valideren");

    const source = readFile("components", "chat", "genui", "platform-card.tsx");
    expect(source).toContain("grid grid-cols-1 gap-2 sm:grid-cols-2");
  });

  it("standardizes touch targets and routes loading through the shared GenUI skeleton", () => {
    const utilsSource = readFile("components", "chat", "genui", "genui-utils.ts");
    const actionSource = readFile("components", "chat", "genui", "action-primitives.tsx");
    const canvasSource = readFile("components", "chat", "genui", "canvas-embed.tsx");
    const skeletonSource = readFile("components", "chat", "genui", "genui-loading-skeleton.tsx");

    expect(utilsSource).toContain("min-h-11");
    expect(actionSource).toContain("genuiTouchTargetClassName");
    expect(canvasSource).toContain("GenUILoadingSkeleton");
    expect(skeletonSource).toContain("rows = 2");
  });
});
