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
});
