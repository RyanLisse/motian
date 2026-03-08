import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]) {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("sidebar shell top-bar refactor", () => {
  it("removes the shared shell header and keeps a compact mobile sidebar trigger", () => {
    const source = readFile("components", "sidebar-layout.tsx");

    expect(source).not.toContain("<header");
    expect(source).toContain("SidebarTrigger");
    expect(source).toContain("md:hidden");
    expect(source).toContain("⌘/Ctrl+B");
  });

  it("moves theme controls into the user menu", () => {
    const source = readFile("components", "nav-user.tsx");

    expect(source).toContain("useTheme");
    expect(source).toContain("Schakel naar lichte modus");
    expect(source).toContain("Schakel naar donkere modus");
  });

  it("keeps AI assistant discovery in the sidebar and user menu", () => {
    const sidebarSource = readFile("components", "app-sidebar.tsx");
    const userSource = readFile("components", "nav-user.tsx");
    const widgetSource = readFile("components", "chat", "chat-widget.tsx");

    expect(sidebarSource).toContain('title: "Interviews"');
    expect(sidebarSource).toContain('title: "Aanbevelingen"');
    expect(sidebarSource).toContain('title: "Kandidaataanbevelingen"');
    expect(sidebarSource).toContain('badge: { text: "⌘J"');
    expect(sidebarSource).toContain('tooltip: "AI Assistent openen (⌘/Ctrl+J)"');
    expect(userSource).toContain("motian-chat-open");
    expect(userSource).toContain("⌘J");
    expect(widgetSource).toContain("CHAT_WIDGET_OPEN_EVENT");
    expect(widgetSource).toContain("currentOrigin={currentOrigin}");
    expect(widgetSource).toContain(
      "<PromptInput allowAttachments={false} onSubmit={handleSubmit}>",
    );
    expect(widgetSource).toContain("allowAttachments={false}");
  });
});
