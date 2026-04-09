import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]) {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("shell performance loading", () => {
  it("defers command palette and chat widget bundles behind loaders", () => {
    const routeShellSource = readFile("components", "route-shell-overlays.tsx");
    const commandLoaderSource = readFile("components", "command-palette-loader.tsx");
    const chatLoaderSource = readFile("components", "chat", "chat-widget-loader.tsx");

    expect(routeShellSource).toContain(
      'import { CommandPaletteLoader } from "@/components/command-palette-loader"',
    );
    expect(routeShellSource).toContain(
      'import { ChatWidgetLoader } from "@/components/chat/chat-widget-loader"',
    );
    expect(routeShellSource).not.toContain('import("@/components/command-palette")');
    expect(routeShellSource).not.toContain('import("@/components/chat/chat-widget")');

    expect(commandLoaderSource).toContain("setShouldLoad(true)");
    expect(commandLoaderSource).toContain("initialOpen={openOnLoad}");
    expect(chatLoaderSource).toContain("setShouldLoad(true)");
    expect(chatLoaderSource).toContain("defaultOpen={openOnLoad}");
  });

  it("lazy-loads telemetry sinks inside the web vitals reporter", () => {
    const source = readFile("src", "components", "web-vitals-reporter.tsx");

    expect(source).toContain('import("posthog-js")');
    expect(source).toContain('import("@sentry/nextjs")');
    expect(source).not.toContain('import * as Sentry from "@sentry/nextjs"');
    expect(source).not.toContain('import posthog from "posthog-js"');
  });

  it("keeps heavy charting surfaces behind dynamic imports on overview and candidate detail pages", () => {
    const overviewSource = readFile("app", "overzicht", "page.tsx");
    const candidateSource = readFile("app", "kandidaten", "[id]", "page.tsx");

    expect(overviewSource).toContain("dynamic(");
    expect(overviewSource).toContain('import("@/components/overview/kpi-trend-chart")');
    expect(candidateSource).toContain(
      'import("@/components/candidate-profile/match-scores-chart")',
    );
    expect(candidateSource).toContain('import("@/components/skills-radar")');
  });
});
