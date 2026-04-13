import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]) {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("mobile shell scroll contract", () => {
  it("keeps document scrolling available on mobile while preventing horizontal overflow", () => {
    const globals = readFile("app", "globals.css");

    expect(globals).toContain("overflow-x: hidden;");
    expect(globals).not.toContain("overscroll-behavior-y: none;");
    expect(globals).not.toContain("overflow: hidden;");
  });

  it("uses viewport-stable shell bounds on mobile and keeps desktop-only shell locking", () => {
    const sidebarUi = readFile("components", "ui", "sidebar.tsx");

    expect(sidebarUi).toContain("min-h-dvh");
    expect(sidebarUi).toContain("md:h-svh");
    expect(sidebarUi).toContain("md:overflow-hidden");
  });

  it("aligns shell reserve space and fixed navigation chrome with shared mobile size tokens", () => {
    const globals = readFile("app", "globals.css");
    const shell = readFile("components", "sidebar-layout.tsx");
    const bottomNav = readFile("components", "mobile-bottom-nav.tsx");

    expect(globals).toContain("--mobile-top-bar-height: 3rem;");
    expect(globals).toContain("--mobile-bottom-nav-height: 4.5rem;");
    expect(shell).toContain("var(--mobile-top-bar-height)");
    expect(shell).toContain("var(--mobile-bottom-nav-height)");
    expect(bottomNav).toContain("var(--mobile-bottom-nav-height)");
  });

  it("gives the job list shell a definite mobile height via the content-height token so the scroll chain resolves", () => {
    const globals = readFile("app", "globals.css");
    const layoutShell = readFile("components", "opdrachten-layout-shell.tsx");

    // Token must be defined, composing both chrome heights and safe-area insets
    expect(globals).toContain("--mobile-content-height");
    expect(globals).toContain("var(--mobile-top-bar-height)");
    expect(globals).toContain("var(--mobile-bottom-nav-height)");
    expect(globals).toContain("env(safe-area-inset-bottom)");

    // Layout shell must use the token on mobile and fall back to h-full on desktop
    expect(layoutShell).toContain("var(--mobile-content-height)");
    expect(layoutShell).toContain("md:h-full");
  });

  it("gives the chat page a definite mobile height via the content-height token so StickToBottom resolves", () => {
    const chatPage = readFile("app", "chat", "page.tsx");
    const chatMessages = readFile("components", "chat", "chat-messages.tsx");

    // Chat page must use the mobile content-height token
    expect(chatPage).toContain("var(--mobile-content-height)");
    expect(chatPage).toContain("md:h-auto");

    // Chat messages must not use raw 100vh (breaks on mobile with chrome)
    expect(chatMessages).not.toContain("100vh");
  });
});
