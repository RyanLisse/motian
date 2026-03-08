import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("chat widget continuity", () => {
  it("keeps shared chat runtime in the root chat provider", () => {
    const source = readFile("components/chat/chat-context-provider.tsx");

    expect(source).toContain("const chat = useChat({");
    expect(source).toContain("prepareFullPageHandoff");
    expect(source).toContain("loadSession");
    expect(source).toContain("activeContext");
  });

  it("adds an explicit handoff from the widget into /chat", () => {
    const source = readFile("components/chat/chat-panel.tsx");

    expect(source).toContain('router.push("/chat")');
    expect(source).toContain("prepareFullPageHandoff");
    expect(source).toContain('if (pathname === "/chat") return null;');
    expect(source).not.toContain('pathname === "/chat" || pathname === "/opdrachten"');
  });

  it("reuses the shared runtime on the full chat page", () => {
    const source = readFile("components/chat/chat-page-content.tsx");

    expect(source).toContain("useChatContext()");
    expect(source).toContain("await loadSession(id);");
    expect(source).toContain("startNewSession();");
    expect(source).toContain("getContextLabel(activeContext)");
    expect(source).not.toContain("useState(() => nanoid())");
    expect(source).not.toContain("DefaultChatTransport");
  });

  it("supports compact widget message layout without a second message surface", () => {
    const source = readFile("components/chat/chat-messages.tsx");

    expect(source).toContain('layout?: "page" | "widget"');
    expect(source).toContain('layout = "page"');
    expect(source).toContain('isWidget = layout === "widget"');
  });
});
